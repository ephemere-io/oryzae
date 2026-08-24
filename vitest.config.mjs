import { defineConfig } from 'vitest/config';

// ルート直下の `scripts/` 用。各アプリは自前の vitest.config を持つため、
// ここは include をリポジトリ運用スクリプトだけに限定する。
export default defineConfig({
  test: {
    include: ['scripts/**/*.test.mjs'],
  },
});
