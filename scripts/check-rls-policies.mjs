#!/usr/bin/env node
/**
 * RLS ゲート — 日記データの認可境界を静的に検証する。
 *
 * なぜ必要か:
 * Oryzae のユーザー向け API は authMiddleware が anon key + ユーザー JWT で
 * Supabase クライアントを作る（apps/server/src/contexts/shared/presentation/middleware/auth.ts）。
 * つまり repository が `.eq('user_id', ...)` を書き忘れても RLS が最後の砦になる設計。
 * 裏を返すと **RLS が抜けた瞬間に他人の日記が読める**。RLS はこのプロダクトの
 * 単一障害点なので、AI レビューの確率的な検出ではなく決定的なゲートで守る。
 *
 * 検査する不変条件:
 *   1. 存在するテーブルは必ず RLS が有効
 *   2. RLS 有効なテーブルには必ずポリシーが 1 つ以上ある（無い = 全拒否で機能不全）
 *   3. USING (true) / WITH CHECK (true) のポリシーに TO 句が無いものを禁止
 *      → Postgres は TO 省略時 PUBLIC 扱い。permissive ポリシーは OR 結合なので
 *        「service role 用」のつもりの USING (true) が anon/authenticated にも効き、
 *        同テーブルの own-data ポリシーを丸ごと無効化する
 *   4. public バケットと、ユーザー隔離の無い storage SELECT ポリシーを禁止
 *      → 署名なし URL で他人のアップロード画像が読める状態を防ぐ
 *
 * 判定は「全マイグレーションを順に再生した最終状態」に対して行う。
 * DROP POLICY / DROP TABLE / バケットの public 更新を追跡するので、
 * 後続マイグレーションで直せばゲートは自然に緑に戻る。
 *
 * 意図的な例外は、対象文の直前行に理由付きで宣言する（リポジトリの
 * `// verify-exempt:` / `// @type-assertion-allowed:` と同じ作法）:
 *
 *   -- @rls-exempt: アバターは公開画像として設計されている
 *   CREATE POLICY "Anyone can view avatars" ...
 *
 * 既知の未修正リスクは supabase/rls-baseline.json に登録する。baseline 済みは
 * warning 扱いで CI を止めない（段階導入を壊さないため）が、直したのに baseline に
 * 残っているとエラーになる（baseline の腐敗防止）。
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS_DIR = join(ROOT, 'supabase', 'migrations');
const BASELINE_PATH = join(ROOT, 'supabase', 'rls-baseline.json');
const EXEMPT_MARKER = '@rls-exempt:';

/** 文の開始位置から、括弧・引用符の外側にある最初の `;` までを 1 文として切り出す。 */
function readStatement(sql, startIndex) {
  let depth = 0;
  let quote = null;
  for (let i = startIndex; i < sql.length; i++) {
    const ch = sql[i];
    if (quote) {
      // 同じ引用符の 2 連続はエスケープ（'' / ""）なので閉じ扱いにしない
      if (ch === quote) {
        if (sql[i + 1] === quote) i++;
        else quote = null;
      }
      continue;
    }
    if (ch === "'" || ch === '"') quote = ch;
    else if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === ';' && depth === 0) return sql.slice(startIndex, i + 1);
  }
  return sql.slice(startIndex);
}

const lineOf = (sql, index) => sql.slice(0, index).split('\n').length;

/**
 * 文の直前 3 行以内に `-- @rls-exempt: <理由>` があれば理由を返す。
 *
 * 「最初の非空行だけを見る」実装にすると、`-- @rls-exempt:` と対象文の間に
 * 普通のコメント行が 1 行挟まっただけで例外宣言が無視される。フェイルクローズ
 * なので穴にはならないが、書いた人は「効かないから baseline に入れる」に
 * 流れやすく、恒久的な抑制に化けてゲートが形骸化する。そのため窓内を走査する。
 */
function exemptionFor(sql, index) {
  const before = sql.slice(0, index).split('\n');
  const LOOKBACK = 3;
  for (let i = before.length - 2; i >= 0 && i >= before.length - 1 - LOOKBACK; i--) {
    const line = (before[i] ?? '').trim();
    const at = line.indexOf(EXEMPT_MARKER);
    if (at === -1) continue;
    return line.slice(at + EXEMPT_MARKER.length).trim() || '(理由未記載)';
  }
  return null;
}

/** `public.entries` / `"entries"` → `entries` に正規化。public 以外の schema は保持。 */
function normalizeTable(raw) {
  const cleaned = raw.replace(/"/g, '').toLowerCase();
  return cleaned.startsWith('public.') ? cleaned.slice('public.'.length) : cleaned;
}

const unquote = (s) => s.replace(/"/g, '');

/**
 * マイグレーションをファイル名順に再生し、最終状態を組み立てる。
 * @returns {{tables: Map, policies: Map, buckets: Map}}
 */
function replay(files) {
  const tables = new Map(); // table -> {table, file, line, rls: boolean}
  const policies = new Map(); // `${table}::${name}` -> policy
  const buckets = new Map(); // bucket -> {bucket, file, line, isPublic, exemption}

  for (const f of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, f), 'utf8');
    const file = `supabase/migrations/${f}`;

    for (const m of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?([\w".]+)/gi)) {
      const table = normalizeTable(m[1]);
      if (!tables.has(table)) {
        tables.set(table, { table, file, line: lineOf(sql, m.index), rls: false });
      }
    }
    for (const m of sql.matchAll(/drop\s+table\s+(?:if\s+exists\s+)?([\w".]+)/gi)) {
      tables.delete(normalizeTable(m[1]));
    }

    for (const m of sql.matchAll(
      /alter\s+table\s+([\w".]+)\s+enable\s+row\s+level\s+security/gi,
    )) {
      const t = tables.get(normalizeTable(m[1]));
      if (t) t.rls = true;
    }
    for (const m of sql.matchAll(
      /alter\s+table\s+([\w".]+)\s+disable\s+row\s+level\s+security/gi,
    )) {
      const t = tables.get(normalizeTable(m[1]));
      if (t) t.rls = false;
    }

    for (const m of sql.matchAll(/create\s+policy\s+/gi)) {
      const stmt = readStatement(sql, m.index);
      const head = /create\s+policy\s+("[^"]+"|\w+)\s+on\s+([\w".]+)/i.exec(stmt);
      if (!head) continue;
      const name = unquote(head[1]);
      const table = normalizeTable(head[2]);
      // キーは (テーブル, ポリシー名)。Postgres は pg_policy の (polrelid, polname) で
      // ポリシー名をテーブル単位に一意化するため、これが DB の実態と一致する。
      // storage.objects は全バケット共通のテーブルなので、バケットが違っても
      // 同名ポリシーは作れない（2 つ目の CREATE POLICY が実行時に失敗する）。
      policies.set(`${table}::${name}`, {
        name,
        table,
        hasToClause: /\bto\s+(service_role|authenticated|anon|public|postgres)\b/i.test(stmt),
        isUnconditional: /\b(using|with\s+check)\s*\(\s*true\s*\)/i.test(stmt),
        scopedToUser: /auth\.uid\s*\(\s*\)/i.test(stmt),
        isSelect: /\bfor\s+(select|all)\b/i.test(stmt),
        file,
        line: lineOf(sql, m.index),
        exemption: exemptionFor(sql, m.index),
      });
    }
    for (const m of sql.matchAll(
      /drop\s+policy\s+(?:if\s+exists\s+)?("[^"]+"|\w+)\s+on\s+([\w".]+)/gi,
    )) {
      policies.delete(`${normalizeTable(m[2])}::${unquote(m[1])}`);
    }

    for (const m of sql.matchAll(/insert\s+into\s+storage\.buckets\s*\(/gi)) {
      const stmt = readStatement(sql, m.index);
      // 列リストと値リストを名前で対応づける。位置や「どこかに true があるか」で
      // 判定すると、列が増えたときに誤検知し、その誤検知が baseline に吸収されて
      // ゲートが形骸化する。
      const head = /insert\s+into\s+storage\.buckets\s*\(([^)]*)\)/i.exec(stmt);
      const values = /values\s*\(([^)]*)\)/i.exec(stmt);
      if (!head || !values) continue;
      const names = head[1].split(',').map((s) => s.trim().replace(/"/g, '').toLowerCase());
      const vals = values[1].split(',').map((s) => s.trim().replace(/'/g, ''));
      const pick = (col) => {
        const i = names.indexOf(col);
        return i === -1 ? undefined : vals[i];
      };
      const id = pick('id');
      if (id === undefined) continue;
      buckets.set(id, {
        bucket: id,
        file,
        line: lineOf(sql, m.index),
        // public 列が省略されている場合、Postgres の既定は false（非公開）
        isPublic: (pick('public') ?? 'false').toLowerCase() === 'true',
        exemption: exemptionFor(sql, m.index),
      });
    }
    // 後から公開設定を締めた場合を反映（update storage.buckets set public = false where id = '...'）
    for (const m of sql.matchAll(/update\s+storage\.buckets\s+/gi)) {
      const stmt = readStatement(sql, m.index);
      const isPublic = /set\s+public\s*=\s*true/i.test(stmt);
      const id = /id\s*=\s*'([^']+)'/i.exec(stmt);
      if (!id) continue;
      const b = buckets.get(id[1]);
      if (b) {
        b.isPublic = isPublic;
        b.exemption = exemptionFor(sql, m.index) ?? b.exemption;
      }
    }
  }

  return { tables, policies, buckets };
}

function collectFindings({ tables, policies, buckets }) {
  const findings = [];
  const add = (id, o, message) => findings.push({ id, file: o.file, line: o.line, message });

  // 1. 存在するテーブルは必ず RLS 有効
  for (const t of tables.values()) {
    if (t.rls) continue;
    add(
      `table-without-rls:${t.table}`,
      t,
      `テーブル "${t.table}" に RLS が有効化されていません。\n` +
        `      → ALTER TABLE ${t.table} ENABLE ROW LEVEL SECURITY; を追加してください。\n` +
        `        ユーザー向け API は RLS を認可境界にしているため、これが抜けると他人のデータが読めます。`,
    );
  }

  // 2. RLS 有効なテーブルにはポリシーが必要
  const tablesWithPolicy = new Set([...policies.values()].map((p) => p.table));
  for (const t of tables.values()) {
    if (!t.rls || tablesWithPolicy.has(t.table)) continue;
    add(
      `rls-without-policy:${t.table}`,
      t,
      `テーブル "${t.table}" は RLS 有効だがポリシーが 1 つもありません。\n` +
        `      → RLS 有効 + ポリシー無し = 全アクセス拒否。アプリが壊れます。`,
    );
  }

  for (const p of policies.values()) {
    // 3. TO 句の無い USING (true) は全ロールに効いてしまう
    if (p.isUnconditional && !p.hasToClause && !p.exemption) {
      add(
        `unconditional-policy:${p.table}:${p.name}`,
        p,
        `ポリシー "${p.name}" (${p.table}) が TO 句なしの USING (true) です。\n` +
          `      → Postgres は TO 省略時 PUBLIC 扱い。permissive ポリシーは OR 結合されるため、\n` +
          `        同テーブルの own-data ポリシーが無効化され、anon/authenticated が全行にアクセスできます。\n` +
          `      → service role はそもそも RLS をバイパスするのでこのポリシー自体が不要なはずです。\n` +
          `        必要なら TO service_role を明示してください。`,
      );
    }

    // 4-b. storage.objects の SELECT ポリシーにユーザー隔離が無い
    if (p.table === 'storage.objects' && p.isSelect && !p.scopedToUser && !p.exemption) {
      add(
        `storage-select-unscoped:${p.name}`,
        p,
        `storage ポリシー "${p.name}" の SELECT にユーザー隔離がありません。\n` +
          `      → bucket_id の一致だけでは、そのバケット内の**全ユーザー**のファイルが読めます。\n` +
          `      → (storage.foldername(name))[1] = auth.uid()::text を条件に加えるか、\n` +
          `        公開が意図的なら直前行に -- @rls-exempt: <理由> を記載してください。`,
      );
    }
  }

  // 4-a. public バケットは署名なし URL で誰でも読める
  for (const b of buckets.values()) {
    if (!b.isPublic || b.exemption) continue;
    add(
      `public-bucket:${b.bucket}`,
      b,
      `storage バケット "${b.bucket}" が public = true です。\n` +
        `      → 署名なし URL で第三者が閲覧できます。ユーザーの非公開コンテンツなら public = false にし、\n` +
        `        署名付き URL で配信してください。公開が意図的なら直前行に -- @rls-exempt: <理由> を記載。`,
    );
  }

  return findings;
}

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return new Map();
  try {
    const parsed = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
    return new Map((parsed.knownIssues ?? []).map((i) => [i.id, i]));
  } catch (e) {
    console.error(`✗ ${BASELINE_PATH} を読めません: ${e.message}`);
    process.exit(1);
  }
}

function main() {
  if (!existsSync(MIGRATIONS_DIR)) {
    console.error(`✗ マイグレーションディレクトリが見つかりません: ${MIGRATIONS_DIR}`);
    process.exit(1);
  }
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const state = replay(files);
  const findings = collectFindings(state);
  const baseline = loadBaseline();

  const fresh = findings.filter((f) => !baseline.has(f.id));
  const known = findings.filter((f) => baseline.has(f.id));
  // 直したのに baseline に残っている = 腐敗。次の混入を見逃す原因になるので落とす。
  const foundIds = new Set(findings.map((f) => f.id));
  const stale = [...baseline.values()].filter((i) => !foundIds.has(i.id));

  const summary =
    `${state.tables.size} テーブル / ${state.policies.size} ポリシー / ` +
    `${state.buckets.size} バケット（${files.length} migration を再生）`;

  // status: 'accepted' = 意図的な設計判断 / 'todo' = 未修正の負債（毎回目に入るよう強調）
  const todo = known.filter((f) => baseline.get(f.id).status !== 'accepted');
  const accepted = known.filter((f) => baseline.get(f.id).status === 'accepted');

  if (todo.length > 0) {
    console.log(`\n⚠ 未修正の既知リスク ${todo.length} 件（baseline 登録済みのため CI は止めない）:`);
    for (const f of todo) {
      const note = baseline.get(f.id);
      console.log(`  ⚠ ${f.file}:${f.line}  ${f.id}`);
      console.log(`      ${note.reason ?? ''}${note.issue ? ` → ${note.issue}` : ''}`);
    }
  }
  if (accepted.length > 0) {
    console.log(`\n許容済み（設計判断）${accepted.length} 件:`);
    for (const f of accepted) {
      console.log(`  · ${f.id} — ${baseline.get(f.id).reason ?? ''}`);
    }
  }

  if (stale.length > 0) {
    console.error(`\n✗ baseline に、もう存在しない項目が残っています:`);
    for (const i of stale) console.error(`  - ${i.id}`);
    console.error(`  → 修正済みです。supabase/rls-baseline.json から削除してください。\n`);
    process.exit(1);
  }

  if (fresh.length > 0) {
    console.error(`\n✗ RLS ゲート: 新規の問題 ${fresh.length} 件\n`);
    for (const f of fresh) console.error(`  ${f.file}:${f.line}  ${f.message}\n`);
    console.error(`  検査対象: ${summary}\n`);
    process.exit(1);
  }

  console.log(`\n✓ RLS ゲート: 新規の問題なし（${summary}）`);
  const exempted = [...state.policies.values(), ...state.buckets.values()].filter(
    (o) => o.exemption,
  );
  for (const o of exempted) {
    console.log(`    例外 ${o.file}:${o.line}  ${o.bucket ?? o.name}: ${o.exemption}`);
  }
}

main();
