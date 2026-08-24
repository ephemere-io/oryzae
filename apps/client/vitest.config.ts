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
      // @oryzae/shared の main は ./dist/index.js を指す（server が本番で dist を使うため）。
      // vitest は dist を作らないので、テストではソースへ直接向ける。
      // 本番ビルドは vercel.json の buildCommand が先に dist を作るので影響しない。
      '@oryzae/shared': resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
});
