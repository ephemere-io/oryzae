import { defineConfig } from 'vitest/config';

// 無いと vitest がルートの vitest.config.mjs（include が scripts/** だけ）を拾い、
// ここのテストを 1 本も見つけない。テストは test/ に置く（src/ は tsc の build 対象）。
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
  },
});
