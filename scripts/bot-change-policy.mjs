#!/usr/bin/env node
/**
 * 自動修正ループの「触ってよい範囲」ゲート — 人のレビュー無しでマージできる差分かを決める。
 *
 * なぜ必要か:
 * このリポジトリは自動マージを前提にしている。つまり **差分の内容を見る人間が居ない**。
 * ガードレール（typecheck / lint / test / dep-cruise / knip / check:as / security:rls）は
 * 「壊れていないこと」は保証するが、「変えてよかったか」は保証しない。
 * マイグレーション・ワークフロー・ユーザー向け文言は、緑のまま取り返しのつかない
 * 変更ができてしまう領域なので、ここで機械的に締め出す。
 *
 * 拒否リストではなく **許可リスト** で書く:
 * 拒否リストは、リポジトリに新しいディレクトリが増えるたびに穴が開く。しかも
 * 穴が開いたことは「自動マージされてしまった後」にしか分からない。許可リストなら、
 * 未知の領域はすべて既定で止まる。止まりすぎたら足せばよい（誤って通すより安い）。
 *
 * 判定は 3 値:
 *   - `auto-merge`  すべて許可領域 → ガードレールが緑ならマージしてよい
 *   - `blocked`     許可外・禁止領域・大きすぎる差分 → マージしない（人へ回す）
 *   - `empty`       変更なし
 */

import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * 触ってよい領域。ここに載っていないパスは、それだけで `blocked` になる。
 *
 * 意図的に「アプリの実装とテストと設計ドキュメント」だけに絞ってある。
 * 設定・インフラ・スキーマは、直し方が正しくても影響範囲が読めないため人が見る。
 */
const ALLOWED = [
  { re: /^apps\/(server|client|admin)\/src\/.+\.(ts|tsx|css)$/, why: 'アプリ実装' },
  { re: /^apps\/(server|client|admin)\/test\/.+\.(ts|tsx)$/, why: 'ユニット/統合テスト' },
  { re: /^apps\/(client|admin)\/e2e\/.+\.ts$/, why: 'E2E テスト' },
  { re: /^packages\/(shared|verify)\/src\/.+\.(ts|tsx)$/, why: '共有パッケージ実装' },
  { re: /^docs\/.+\.md$/, why: '設計ドキュメント' },
];

/**
 * 許可領域の内側にあっても止める場所。許可より常に優先する。
 *
 * どれも「ガードレールが緑のまま、取り返しのつかないことが起きる」場所である。
 */
const DENIED = [
  {
    re: /^apps\/client\/src\/i18n\/messages\//,
    why: 'ユーザー向け文言（表示される言葉はプロダクトの約束そのもので、機械が変えてよい対象ではない）',
  },
  {
    re: /middleware\/auth/,
    why: '認可ミドルウェア（RLS を効かせるクライアント生成箇所。ここが変わると認可境界が動く）',
  },
  {
    re: /supabase-client\.ts$/,
    why: 'service role クライアント（RLS を完全にバイパスする）',
  },
  {
    re: /\.dependency-cruiser\./,
    why: 'アーキテクチャ依存ルール（ゲートそのもの）',
  },
  {
    re: /^apps\/(client|admin)\/src\/instrumentation\.ts$/,
    why: '監視の初期化（日記本文が Sentry へ載る経路に関わる）',
  },
  {
    re: /^apps\/(server|client|admin)\/src\/middleware\.ts$/,
    why: 'Next.js middleware（全リクエストの入口。認証リダイレクトを含む）',
  },
];

/** 新規追加のときだけ止める場所。 */
const DENIED_WHEN_ADDED = [
  {
    re: /^apps\/client\/src\/features\/.+\/components\/.+\.tsx$/,
    why: '新規 client コンポーネント（検証ハーネス *.verify.tsx を要する領域。新規部品づくりは自動修正の仕事ではない）',
  },
];

/**
 * 1 回の自動修正で触ってよいファイル数の上限。
 *
 * バグ 1 件の修正が 15 ファイルに広がることは、まず無い。広がったときは
 * 「直しているつもりでリファクタしている」ので、内容が正しくても人が見るべきである。
 */
export const DEFAULT_MAX_FILES = 15;

/** `git diff --name-status -M` の出力を {status, path} の配列にする。 */
export function parseNameStatus(text) {
  const changes = [];
  for (const line of String(text ?? '').split('\n')) {
    if (line.trim() === '') continue;
    const parts = line.split('\t');
    const code = parts[0]?.[0];
    if (!code) continue;
    // リネーム/コピーは「新しいパスへの追加」として扱う（旧パスの削除は追わない）。
    const path = code === 'R' || code === 'C' ? parts[2] : parts[1];
    if (!path) continue;
    changes.push({ status: code === 'C' ? 'A' : code, path });
  }
  return changes;
}

/** 差分を判定する。理由は必ず人が読める言葉で返す（Issue にそのまま貼るため）。 */
export function classify(changes, { maxFiles = DEFAULT_MAX_FILES } = {}) {
  const list = changes ?? [];
  if (list.length === 0) return { verdict: 'empty', reasons: [] };

  const reasons = [];

  if (list.length > maxFiles) {
    reasons.push(`変更ファイルが ${list.length} 件で上限 ${maxFiles} 件を超えた（1 件のバグ修正としては広すぎる）`);
  }

  for (const { status, path } of list) {
    const denied = DENIED.find((d) => d.re.test(path));
    if (denied) {
      reasons.push(`${path} — ${denied.why}`);
      continue;
    }
    if (status === 'A') {
      const deniedNew = DENIED_WHEN_ADDED.find((d) => d.re.test(path));
      if (deniedNew) {
        reasons.push(`${path}（新規追加） — ${deniedNew.why}`);
        continue;
      }
    }
    if (!ALLOWED.some((a) => a.re.test(path))) {
      reasons.push(`${path} — 自動マージの許可領域外`);
    }
  }

  return reasons.length > 0 ? { verdict: 'blocked', reasons } : { verdict: 'auto-merge', reasons: [] };
}

// ── CLI ────────────────────────────────────────────────────────────────────

function main() {
  const source = process.argv[2] ?? '-';
  const input = source === '-' ? readFileSync(0, 'utf8') : readFileSync(source, 'utf8');
  const result = classify(parseNameStatus(input));

  console.log(`verdict=${result.verdict}`);
  for (const r of result.reasons) console.log(`  ✗ ${r}`);

  // 理由は複数行になるので GITHUB_OUTPUT ではなくファイルで渡す
  // （ワークフローはこれをそのまま Issue コメントに貼る）。
  const reasonsOut = process.argv[3];
  if (reasonsOut) writeFileSync(reasonsOut, result.reasons.map((r) => `- ${r}`).join('\n'));
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `verdict=${result.verdict}\n`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
