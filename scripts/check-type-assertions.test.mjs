#!/usr/bin/env node
/**
 * `check-type-assertions.mjs` の自己テスト。
 *
 * このスクリプトは CI ゲートとして「`as` を機械的に禁止する」と宣言している以上、
 * 検出漏れ（false negative）は「通っているのに守られていない」状態を作る。
 * 自前の字句解析＋ヒューリスティックなので、実際に開発中2度バグを踏んでいる
 * （小文字始まりの型の取りこぼし、テンプレートリテラルの `${}` 復帰漏れ）。
 *
 *   node scripts/check-type-assertions.test.mjs
 */

import { mightContainCast, scanSource } from './check-type-assertions.mjs';

let passed = 0;
const failures = [];

/** @param {string} name @param {string} source @param {number[]} expectedLines */
function expectViolations(name, source, expectedLines) {
  const { violations } = scanSource(source);
  const actual = violations.map((v) => v.line);
  const ok =
    actual.length === expectedLines.length && actual.every((l, i) => l === expectedLines[i]);
  if (ok) {
    passed += 1;
  } else {
    failures.push(
      `${name}\n    期待: [${expectedLines.join(', ')}]  実際: [${actual.join(', ')}]` +
        (violations.length ? `\n    検出行: ${violations.map((v) => v.text).join(' / ')}` : ''),
    );
  }
}

/** @param {string} name @param {string} source @param {number} expected */
function expectAllowed(name, source, expected) {
  const { allowed } = scanSource(source);
  if (allowed === expected) passed += 1;
  else failures.push(`${name}\n    許可数 期待: ${expected}  実際: ${allowed}`);
}

// ── 基本の検出 ────────────────────────────────────────────────
expectViolations('素のキャストを検出する', `const a = b as Foo;\n`, [1]);

expectViolations(
  '小文字始まりの型も検出する（過去の取りこぼし）',
  `const a = b as string;\nconst c = d as number;\nconst e = f as unknown;\n`,
  [1, 2, 3],
);

expectViolations('角括弧つきの型も検出する', `const a = b as string[];\n`, [1]);

expectViolations(
  '`as unknown as T` は 1 件として数える',
  `const a = b as unknown as Foo;\n`,
  [1],
);

expectViolations(
  '`as` と型名の間で改行されたキャストも検出する（`as` のある行に帰属）',
  ['const a =', '  someVeryLongExpression as', '    SomeVeryLongTypeName;', ''].join('\n'),
  [2],
);

expectViolations(
  'タブ区切りのキャストも検出する',
  ['const a = b\tas\tFoo;', ''].join('\n'),
  [1],
);

expectAllowed(
  '改行されたキャストでも直前の行の許可コメントが効く',
  [
    '// @type-assertion-allowed: 理由あり',
    'const a = someVeryLongExpression as',
    '  SomeVeryLongTypeName;',
    '',
  ].join('\n'),
  1,
);

// ── 対象外にすべきもの ────────────────────────────────────────
expectViolations('`as const` は対象外', `const a = { x: 1 } as const;\n`, []);

expectViolations('`import * as X` は対象外', `import * as React from 'react';\n`, []);

expectViolations(
  '名前付き import の別名は対象外',
  `import { a as b, c as d } from 'x';\n`,
  [],
);

expectViolations(
  '再エクスポートの別名は対象外',
  `export { a as b } from 'x';\nexport * as ns from 'y';\n`,
  [],
);

// ── 複数行 import/export（レビューで指摘された検出漏れ疑い）──────
expectViolations(
  '複数行 import の直後にあるキャストを見落とさない',
  [
    'import {',
    '  aaa,',
    '  bbb as ccc,',
    "} from 'x';",
    '',
    'const v = w as Foo;', // 6行目 — ここが検出されなければ検出漏れ
    '',
  ].join('\n'),
  [6],
);

expectViolations(
  '複数行の名前付き export の直後にあるキャストを見落とさない',
  [
    'export {',
    '  aaa,',
    '  bbb as ccc,',
    '};',
    '',
    'const v = w as Foo;', // 6行目
    '',
  ].join('\n'),
  [6],
);

expectViolations(
  '`export const x = {...} as T` は export 句ではないので検出する',
  ['export const x = {', '  a: 1,', '} as Foo;', ''].join('\n'),
  [3],
);

// ── 文字列・コメント・テンプレートリテラル ─────────────────────
expectViolations(
  '行コメント内の "as" は拾わない',
  `// treat this as a note\nconst a = 1;\n`,
  [],
);

expectViolations(
  'ブロックコメント内の "as" は拾わない',
  `/*\n * observe and interpret as a detached third party\n */\nconst a = 1;\n`,
  [],
);

expectViolations('文字列内の "as" は拾わない', `const s = 'treat as text';\n`, []);

expectViolations(
  'テンプレートリテラル内の "as" は拾わない（アポストロフィ入り）',
  ['const prompt = `', "  Don't address them as a reader.", '  Interpret as a third party.', '`;', ''].join(
    '\n',
  ),
  [],
);

expectViolations(
  'テンプレート補間の中のキャストは検出する',
  ['const s = `x${ y as Foo }z`;', ''].join('\n'),
  [1],
);

expectViolations(
  'テンプレートを閉じた後のキャストを見落とさない（過去のバグ）',
  ['const t = `', "  it doesn't matter, treat as prose", '`;', 'const v = w as Foo;', ''].join('\n'),
  [4],
);

// ── 許可コメント ──────────────────────────────────────────────
expectAllowed(
  '直前の行の許可コメントを認める',
  `// @type-assertion-allowed: 理由あり\nconst a = b as Foo;\n`,
  1,
);

expectAllowed(
  '同じ行末尾の許可コメントを認める',
  `const a = b as Foo; // @type-assertion-allowed: 理由あり\n`,
  1,
);

expectAllowed(
  '複数行リテラルでは文の先頭の上のコメントを認める',
  [
    '  // @type-assertion-allowed: 部分スタブのため',
    '  const client = {',
    '    auth: {},',
    '  } as unknown as SupabaseClient;',
    '',
  ].join('\n'),
  1,
);

expectViolations(
  '理由が空の許可コメントは違反のまま',
  `// @type-assertion-allowed:\nconst a = b as Foo;\n`,
  [2],
);

expectViolations(
  '無関係なコメントでは許可されない',
  `// ただのメモ\nconst a = b as Foo;\n`,
  [2],
);

expectAllowed(
  '複数行にわたる理由書きでも認める',
  [
    '  // @type-assertion-allowed: SupabaseClient は内部多数のメソッドを持つが',
    '  // 実際に触るものだけ実装する。',
    '  const client = {',
    '    from,',
    '  } as unknown as SupabaseClient;',
    '',
  ].join('\n'),
  1,
);

// ── 走査前の足切り（main() のパス）────────────────────────────
// ここが CAST_RE より狭いとファイルごとスキップされ、中の違反が全部隠れる。
function expectPrefilter(name, source, expected) {
  const actual = mightContainCast(source);
  if (actual === expected) passed += 1;
  else failures.push(`${name}\n    足切り 期待: ${expected}  実際: ${actual}`);
}

expectPrefilter('通常のキャストを含むファイルは走査対象', 'const a = b as Foo;\n', true);

expectPrefilter(
  'タブ区切りのキャストも走査対象（空白限定にしてはいけない）',
  'const a = b\tas\tFoo;\n',
  true,
);

expectPrefilter('改行を挟むキャストも走査対象', 'const a = b as\n  Foo;\n', true);

expectPrefilter('`as` を含まないファイルは走査しない', 'const a = b;\n', false);

expectPrefilter('識別子の一部の "as" では走査しない', 'const parseAs = 1;\nconst has = 2;\n', false);

// 足切りは CAST_RE より緩くなければならない。上のケースすべてで両者を突き合わせる。
for (const [label, src] of [
  ['space', 'const a = b as Foo;\n'],
  ['tab', 'const a = b\tas\tFoo;\n'],
]) {
  const { violations } = scanSource(src);
  if (violations.length > 0 && !mightContainCast(src)) {
    failures.push(`足切りが CAST_RE より狭い (${label}): 検出できるのにファイルが飛ばされる`);
  } else {
    passed += 1;
  }
}

// ── 結果 ──────────────────────────────────────────────────────
if (failures.length === 0) {
  console.log(`✔ check-type-assertions self-test: ${passed} 件すべて通過`);
  process.exit(0);
}

console.error(`✖ check-type-assertions self-test: ${failures.length} 件失敗 / ${passed} 件通過\n`);
for (const f of failures) console.error(`  - ${f}\n`);
process.exit(1);
