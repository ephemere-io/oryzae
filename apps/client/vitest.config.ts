import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    root: '.',
    passWithNoTests: true,
    // ソース提供の workspace パッケージ（TSX）を vitest 側でも変換させる。
    server: {
      deps: {
        inline: [/@oryzae\/verify/, /@oryzae\/shared/],
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      // `@oryzae/shared` の `main` は dist を指すため、未ビルドだと vitest が
      // "Failed to resolve entry for package" で落ちる（CI の test ジョブは
      // shared を build しない）。テストはソースを直接見れば十分なので、
      // `@oryzae/verify` と同じくソース解決に寄せてビルド状態から独立させる。
      '@oryzae/shared': resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
});
