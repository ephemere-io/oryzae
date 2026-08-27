#!/usr/bin/env node
/**
 * `as` 型アサーション禁止ルールの CI ゲート。
 *
 * CLAUDE.md / .claude/rules/quality.md の「`as` キャスト禁止」を機械的に強制する。
 * やむを得ない箇所は直前の行に `// @type-assertion-allowed: <理由>` を書けば許可される
 * （理由は必須。空だと違反扱い）。
 *
 * 検出対象: apps/ と packages/ 配下の .ts / .tsx。
 * 除外: `as const`、import/export 句の別名（`import * as X`, `{ a as b }`）、
 *       文字列・コメント内の "as"、node_modules 等のビルド生成物。
 *
 *   node scripts/check-type-assertions.mjs          違反があれば exit 1
 *   node scripts/check-type-assertions.mjs --list   違反を一覧表示（exit 0）
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const TARGET_DIRS = ['apps', 'packages'];
const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  '.next',
  'coverage',
  '.git',
  'test-results',
  'playwright-report',
]);
const MARKER = '@type-assertion-allowed';

/** 文字列・テンプレート・コメントの中身を空白に潰す（行数と桁は維持する）。 */
function blankOutNonCode(source) {
  const out = source.split('');
  let i = 0;
  const n = source.length;
  // 状態: none | line-comment | block-comment | single | double | backtick
  let state = 'none';
  // ネストした `${ ... }` ごとの波括弧の深さ。空ならテンプレート補間の外。
  const interpolation = [];

  const blank = (idx) => {
    if (idx < n && out[idx] !== '\n') out[idx] = ' ';
  };

  while (i < n) {
    const c = source[i];
    const next = source[i + 1];

    if (state === 'none') {
      if (c === '/' && next === '/') {
        state = 'line-comment';
        blank(i);
        blank(i + 1);
        i += 2;
        continue;
      }
      if (c === '/' && next === '*') {
        state = 'block-comment';
        blank(i);
        blank(i + 1);
        i += 2;
        continue;
      }
      if (c === "'" || c === '"') {
        state = c === "'" ? 'single' : 'double';
        i += 1;
        continue;
      }
      if (c === '`') {
        state = 'backtick';
        i += 1;
        continue;
      }
      // テンプレート補間 `${ ... }` の内側では、対応する `}` で文字列へ戻る
      if (interpolation.length > 0) {
        if (c === '{') {
          interpolation[interpolation.length - 1] += 1;
        } else if (c === '}') {
          if (interpolation[interpolation.length - 1] === 0) {
            interpolation.pop();
            state = 'backtick';
          } else {
            interpolation[interpolation.length - 1] -= 1;
          }
        }
      }
      i += 1;
      continue;
    }

    if (state === 'line-comment') {
      if (c === '\n') {
        state = 'none';
        i += 1;
        continue;
      }
      blank(i);
      i += 1;
      continue;
    }

    if (state === 'block-comment') {
      if (c === '*' && next === '/') {
        blank(i);
        blank(i + 1);
        state = 'none';
        i += 2;
        continue;
      }
      blank(i);
      i += 1;
      continue;
    }

    // 文字列・テンプレートリテラルの内側
    if (c === '\\') {
      blank(i);
      blank(i + 1);
      i += 2;
      continue;
    }
    if (state === 'single' && c === "'") {
      state = 'none';
      i += 1;
      continue;
    }
    if (state === 'double' && c === '"') {
      state = 'none';
      i += 1;
      continue;
    }
    if (state === 'backtick') {
      if (c === '$' && next === '{') {
        interpolation.push(0);
        state = 'none';
        i += 2;
        continue;
      }
      if (c === '`') {
        state = 'none';
        i += 1;
        continue;
      }
    }

    blank(i);
    i += 1;
  }

  return out.join('');
}

/** import/export の別名句にある `as` を無視するため、該当行を印付けする。 */
function markModuleAliasLines(lines) {
  const isAlias = new Array(lines.length).fill(false);
  let inClause = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();

    if (inClause) {
      isAlias[i] = true;
      if (/\bfrom\b|;/.test(trimmed) || trimmed.endsWith('}')) inClause = false;
      continue;
    }

    // `import ...`（型・値どちらも）は行全体が別名句
    if (/^import\b/.test(trimmed)) {
      isAlias[i] = true;
      // 閉じていない複数行 import
      if (!/\bfrom\b/.test(trimmed) && !trimmed.endsWith(';')) inClause = true;
      continue;
    }

    // 再エクスポート / 名前付きエクスポート句のみ。`export const x = y as T` は対象外。
    if (/^export\s*\*/.test(trimmed) || /^export\s*(type\s*)?\{/.test(trimmed)) {
      isAlias[i] = true;
      if (!/\bfrom\b/.test(trimmed) && !trimmed.endsWith(';') && !trimmed.includes('}')) {
        inClause = true;
      }
    }
  }

  return isAlias;
}

function* walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      yield* walk(full);
    } else if (/\.tsx?$/.test(entry) && !entry.endsWith('.d.ts')) {
      yield full;
    }
  }
}

/** 行に理由付きの許可コメントが含まれるか。 */
function isAllowLine(line) {
  const at = line.indexOf(MARKER);
  if (at === -1) return false;
  const rest = line.slice(at + MARKER.length).replace(/^:/, '').trim();
  return rest.length > 0;
}

function indentOf(line) {
  return line.length - line.trimStart().length;
}

/**
 * 許可コメントがあるか。次のいずれかで認める:
 *   1. キャストと同じ行の末尾コメント
 *   2. 直前の非空行
 *   3. その文の先頭行の直前
 *
 * 3 は複数行リテラルのためにある。次の形はキャストが閉じ行に来るので、
 * コメントは「文の先頭の上」に置くのが自然:
 *
 *   // @type-assertion-allowed: 理由
 *   const client = {
 *     auth: { admin: { getUserById } },
 *   } as unknown as SupabaseClient;
 */
function hasAllowComment(rawLines, index) {
  if (isAllowLine(rawLines[index])) return true;

  // 直前の非空行
  let prev = index - 1;
  while (prev >= 0 && rawLines[prev].trim() === '') prev -= 1;
  if (prev >= 0 && isAllowLine(rawLines[prev])) return true;

  // 文の先頭までさかのぼる（キャスト行より深くインデントされた行は同じ文の内側）
  const castIndent = indentOf(rawLines[index]);
  let start = index - 1;
  while (start >= 0) {
    const line = rawLines[start];
    if (line.trim() === '') break;
    if (indentOf(line) <= castIndent) break;
    start -= 1;
  }
  if (start < 0) return false;

  // 文の先頭行そのもの、およびその直前の連続するコメント行を見る
  for (let i = start; i >= 0 && i >= start - 4; i -= 1) {
    const line = rawLines[i].trim();
    if (line === '') break;
    if (isAllowLine(line)) return true;
    // コメント行が続く間だけさかのぼる（複数行の理由書きに対応）
    if (i !== start && !line.startsWith('//') && !line.startsWith('*')) break;
  }
  return false;
}

// `as const` 以外の ` as ` を型アサーションとみなす。
// 1 行に複数あっても 1 件（`as unknown as T` を二重計上しない）。
const CAST_RE = /(^|[^A-Za-z0-9_$.])as\s+(?!const\b)([A-Za-z_$([{]|<)/;

/**
 * 1 ファイル分のソースを走査する。
 * @returns {{violations: {line: number, text: string}[], allowed: number}}
 */
export function scanSource(source) {
  const violations = [];
  let allowed = 0;

  const rawLines = source.split('\n');
  const codeLines = blankOutNonCode(source).split('\n');
  const isAlias = markModuleAliasLines(rawLines);

  for (let i = 0; i < codeLines.length; i += 1) {
    if (isAlias[i]) continue;
    if (!CAST_RE.test(codeLines[i])) continue;
    if (hasAllowComment(rawLines, i)) {
      allowed += 1;
    } else {
      violations.push({ line: i + 1, text: rawLines[i].trim() });
    }
  }

  return { violations, allowed };
}

function main() {
  const violations = [];
  let allowed = 0;

  for (const target of TARGET_DIRS) {
    for (const file of walk(join(ROOT, target))) {
      const raw = readFileSync(file, 'utf8');
      if (!raw.includes(' as ')) continue;

      const result = scanSource(raw);
      allowed += result.allowed;
      for (const v of result.violations) {
        violations.push({ file: relative(ROOT, file).split(sep).join('/'), ...v });
      }
    }
  }

  const listOnly = process.argv.includes('--list');

  if (violations.length === 0) {
    console.log(`✔ type assertions: 違反なし（許可済み ${allowed} 件）`);
    process.exit(0);
  }

  console.error(`✖ \`as\` 型アサーションが ${violations.length} 件見つかりました（許可済み ${allowed} 件）`);
  console.error('');
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}`);
    console.error(`      ${v.text.slice(0, 120)}`);
    if (process.env.GITHUB_ACTIONS) {
      console.log(
        `::error file=${v.file},line=${v.line}::\`as\` キャスト禁止。型ガードを書くか、直前の行に '// ${MARKER}: <理由>' を記載してください（.claude/rules/quality.md）。`,
      );
    }
  }
  console.error('');
  console.error('型ガードを書くか、やむを得ない場合は直前の行に次を記載してください:');
  console.error(`  // ${MARKER}: <理由>`);

  process.exit(listOnly ? 0 : 1);
}

// 直接実行されたときだけ走らせる（テストから scanSource を import できるように）
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
