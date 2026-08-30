import { defineConfig } from 'vitest/config';

// ルート直下の `scripts/` 用。各アプリは自前の vitest.config を持つため、
// ここは include をリポジトリ運用スクリプトだけに限定する。
export default defineConfig({
  test: {
    include: ['scripts/**/*.test.mjs'],
    // check-type-assertions.test.mjs は vitest ではなく単独実行の自己テストで、
    // 成功時に process.exit(0) を呼ぶ。vitest から起動するとこれが
    // 「テスト中に process.exit が呼ばれた」と判定されて落ちるため除外する。
    // 実行は `pnpm check:as`（本体より先に自己テストを回す）が担う。
    exclude: ['scripts/check-type-assertions.test.mjs'],
  },
});
