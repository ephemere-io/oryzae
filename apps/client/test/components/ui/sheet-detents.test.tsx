import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Sheet, type SheetDetent } from '@/components/ui/sheet';

/** 段の並び（低い順）を渡してシートを描き、縦に積んだ 2 つの高さを返す。席は無し（その場に描く）。 */
function renderSheet(detents: readonly SheetDetent[]) {
  const view = render(
    <Sheet
      open
      detents={detents}
      detent={detents[0] ?? 'full'}
      onDetentChange={() => {}}
      modal={false}
      ariaLabel="試しのシート"
      header={<div>見出し</div>}
      slot={null}
    >
      <p>中身</p>
    </Sheet>,
  );
  const sheet = view.container.querySelector('[role="dialog"]');
  if (!(sheet instanceof HTMLElement)) throw new Error('シートが描かれていない');
  const space = sheet.previousElementSibling;
  if (!(space instanceof HTMLElement)) throw new Error('空きが描かれていない');
  return { 板: sheet.style.height, 空き: space.style.height };
}

describe('Sheet の縦の組み立て（空き + 板）', () => {
  // このリポジトリの vitest はテストの間に DOM を片付けないので、毎回外す。
  afterEach(cleanup);

  it('全画面まで行く板は容器と同じ高さ（中身がはみ出しても伸びない）', () => {
    const { 板, 空き } = renderSheet(['peek', 'half', 'full']);
    expect(板).toBe('100cqh');
    // 空きは「容器 − いちばん低い段（覗く＝見出しの行）」。だから位置 0 ＝ 覗く段。
    expect(空き).toBe('calc(100cqh - var(--oz-sheet-header, 0px))');
  });

  it('半分から始まるシートの空きは容器の半分', () => {
    // jsdom の CSSOM は `calc(100cqh - 50cqh)` をその場で畳む（ブラウザでも同じ値）。
    expect(renderSheet(['half', 'full']).空き).toBe('calc(50cqh)');
  });

  it('段が 1 つだけなら板は中身ぶん＝上に引ける空きが残らない', () => {
    // 空き（容器 − 中身）+ 板（中身）= 容器。スクロールできる幅が 0 になるので、
    // 伸びる先が無いのに指で持ち上がって戻る、という嘘の手応えが出ない。
    const { 板, 空き } = renderSheet(['content']);
    expect(板).toBe('min(var(--oz-sheet-content, 100cqh), 100cqh)');
    expect(空き).toBe('calc(100cqh - min(var(--oz-sheet-content, 100cqh), 100cqh))');
  });
});
