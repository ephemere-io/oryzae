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
        inline: [/@oryzae\/verify/],
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
