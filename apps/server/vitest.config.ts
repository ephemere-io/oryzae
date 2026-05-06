import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      // workspace の @oryzae/shared を source TS に直接マップする。
      // package.json の main は ./dist/index.js を指すため CI で事前ビルドしないと
      // resolve に失敗する。vitest は TS を素のまま扱えるので源流を指せば良い。
      '@oryzae/shared': resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
  test: {
    root: '.',
  },
});
