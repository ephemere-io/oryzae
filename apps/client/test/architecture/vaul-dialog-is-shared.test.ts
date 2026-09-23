import { realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { describe, expect, it } from 'vitest';

// 板（`components/ui/dock-sheet-vaul.tsx`）は、Vaul が中で作る Radix の Dialog を
// **非モーダルの文脈で上書き**している。Vaul は `DialogPrimitive.Root` に `modal` を渡さないため、
// 上書きしないと面はモーダル扱いになり、焦点の檻・`aria-hidden`・`pointer-events` の停止が付く
// （実機: 発酵の結果が出ていると本文が書けない）。
//
// この上書きは「Vaul と私たちが**同じ実体の** Radix Dialog を読んでいる」ことが前提。
// 別実体になると React の文脈が別物になり、上書きは**黙って**効かなくなる（型もテストも通る）。
// だからここで実体の同一性を見張る。落ちたときは apps/client の `@radix-ui/react-dialog` の
// 版を Vaul が要求する版に合わせ直すこと。

const require = createRequire(import.meta.url);
const clientRoot = dirname(require.resolve('../../package.json'));

function radixDialogFrom(from: string): string {
  return realpathSync(require.resolve('@radix-ui/react-dialog', { paths: [from] }));
}

describe('Vaul と client は同じ Radix Dialog を読む', () => {
  it('解決先のファイルが一致する', () => {
    const vaulDir = dirname(realpathSync(require.resolve('vaul', { paths: [clientRoot] })));
    expect(radixDialogFrom(vaulDir)).toBe(radixDialogFrom(clientRoot));
  });
});
