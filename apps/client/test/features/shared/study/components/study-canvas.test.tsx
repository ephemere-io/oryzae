import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StudyCanvas } from '@/features/shared/study/components/study-canvas';
import { PC_LAYOUT, SP_LAYOUT } from '@/features/shared/study/layout';
import type { StudyState } from '@/features/shared/study/types';

/**
 * jsdom には WebGL が無いので `initScene` は必ず投げる。
 *
 * それはこのテストの都合ではなく、**WebGL 非対応の実機で起きること**そのもの。
 * 「白画面にならない」という受け入れ基準（40-acceptance.md「品質」）を、ここで固定する。
 */

afterEach(cleanup);

const STATE: StudyState = {
  now: '2026-09-02',
  unreadCount: 0,
  fermentation: { readiness: 0.4, status: 'fermenting', letters: [] },
  words: ['発酵'],
  notebooks: [{ month: '2026-09', entryCount: 3, current: true }],
  entries: [],
  questions: [],
  board: { dateKey: '2026-09-02', viewType: 'daily', cards: [] },
};

function renderCanvas(overrides: Partial<React.ComponentProps<typeof StudyCanvas>> = {}) {
  return render(
    <StudyCanvas
      state={STATE}
      layout={PC_LAYOUT}
      theme="light"
      onNavigate={vi.fn()}
      {...overrides}
    />,
  );
}

describe('StudyCanvas', () => {
  it('WebGL が使えなくても落ちない（白画面にしない）', () => {
    expect(() => renderCanvas()).not.toThrow();
  });

  it('WebGL が使えなくても入れ物は描画される（フォールバックを重ねられる）', () => {
    const { container } = renderCanvas();
    expect(container.firstElementChild).not.toBeNull();
  });

  it('シーンが作れなければ canvas を残さない', () => {
    // 初期化に失敗した renderer の canvas が残ると、押せない黒い矩形になる。
    const { container } = renderCanvas();
    expect(container.querySelectorAll('canvas')).toHaveLength(0);
  });

  it('ポインタ操作が例外にならない（ハンドルが無くても無視する）', () => {
    const { container } = renderCanvas();
    const root = container.firstElementChild;
    if (!(root instanceof HTMLElement)) throw new Error('missing root');

    expect(() => {
      root.dispatchEvent(new MouseEvent('pointermove', { bubbles: true }));
      root.dispatchEvent(new MouseEvent('pointerleave', { bubbles: true }));
      root.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
      root.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }).not.toThrow();
  });

  it('シーンが作れないときは遷移も起きない', () => {
    const onNavigate = vi.fn();
    const { container } = renderCanvas({ onNavigate });
    const root = container.firstElementChild;
    if (!(root instanceof HTMLElement)) throw new Error('missing root');

    root.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('アンマウントしても canvas が積み上がらない', () => {
    // 10 回出入りしても document 全体で canvas が増えないこと。
    for (let i = 0; i < 10; i++) {
      const view = renderCanvas();
      view.unmount();
    }
    expect(document.querySelectorAll('canvas')).toHaveLength(0);
  });

  it('SP の配置でも同じように壊れない', () => {
    expect(() => renderCanvas({ layout: SP_LAYOUT })).not.toThrow();
  });

  it('記録も手紙も無い状態で描画できる', () => {
    const empty: StudyState = {
      ...STATE,
      words: [],
      notebooks: [],
      fermentation: { readiness: 0, status: 'idle', letters: [] },
    };
    expect(() => renderCanvas({ state: empty })).not.toThrow();
  });
});
