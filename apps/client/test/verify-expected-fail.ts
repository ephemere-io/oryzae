/**
 * 意図的に壊れていて FAIL すべき fixture（嘘検出の実証）。
 *
 * matrix ゲート（verify.matrix.test.ts）と PR レポート（verify-report.test.ts）が共有する。
 * ここに載った fixture は「FAIL することが期待値」なので、レポートでも赤❌を *(expected)* と注記する。
 */
export const EXPECTED_FAIL = new Set<string>(['ExampleProgress::inconsistent']);
