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
      // workspace の @oryzae/shared を source TS に直接マップする（server の
      // vitest.config.ts と同じ手当て）。package.json の main は ./dist/index.js を
      // 指すため CI で事前ビルドしないと resolve に失敗する。vitest は TS を素のまま
      // 扱えるので源流を指せば良い。
      //
      // client では長らく `import type` しか無く（型は package.json の types が
      // ./src を指すので tsc だけで解決でき、実行時には消える）表面化していなかった。
      // 定数など **値** を import した瞬間に効いてくる。本番ビルドは next.config.ts の
      // transpilePackages が同じ役割を担っている。
      '@oryzae/shared': resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
});
