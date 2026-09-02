import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CanvasZoomControls } from '@/components/ui/canvas-zoom-controls';
import jaMessages from '@/i18n/messages/ja.json';
import { MAX_SCALE, MIN_SCALE } from '@/lib/canvas/viewport';

// 状態を持たない導出表示（%表示と上限・下限の無効化）。ここが崩れると
// ユーザーは上限に張り付いたまま押せるボタンを押し続け、操作が効かない画面に見える。
// jest-dom は入れていないので素の DOM で assert する。

function renderControls(scale: number, handlers: Partial<Record<string, () => void>> = {}) {
  const noop = () => {};
  return render(
    <NextIntlClientProvider locale="ja" messages={jaMessages}>
      <CanvasZoomControls
        scale={scale}
        onZoomIn={handlers.onZoomIn ?? noop}
        onZoomOut={handlers.onZoomOut ?? noop}
        onReset={handlers.onReset ?? noop}
        onFit={handlers.onFit ?? noop}
      />
    </NextIntlClientProvider>,
  );
}

function button(label: string): HTMLButtonElement {
  const el = screen.getByLabelText(label);
  if (!(el instanceof HTMLButtonElement)) throw new Error(`"${label}" is not a button`);
  return el;
}

const zoomIn = () => button('ズームイン');
const zoomOut = () => button('ズームアウト');
const reset = () => button('ズームをリセット');

describe('CanvasZoomControls', () => {
  afterEach(cleanup);

  it('倍率を整数パーセントで表示する', () => {
    renderControls(1);
    expect(reset().textContent?.trim()).toBe('100%');
  });

  it('端数の倍率は四捨五入して表示する', () => {
    renderControls(2 / 3);
    expect(reset().textContent?.trim()).toBe('67%');
  });

  it('等倍では両方のズームボタンが押せる', () => {
    renderControls(1);
    expect(zoomIn().disabled).toBe(false);
    expect(zoomOut().disabled).toBe(false);
  });

  it('下限ではズームアウトだけが無効になる', () => {
    renderControls(MIN_SCALE);
    expect(zoomOut().disabled).toBe(true);
    expect(zoomIn().disabled).toBe(false);
  });

  it('上限ではズームインだけが無効になる（下限と対称）', () => {
    renderControls(MAX_SCALE);
    expect(zoomIn().disabled).toBe(true);
    expect(zoomOut().disabled).toBe(false);
  });

  it('契約（data-verify-*）が表示と一致する', () => {
    const { container } = renderControls(MAX_SCALE);
    const root = container.querySelector('[data-verify-unit="CanvasZoomControls"]');
    expect(root?.getAttribute('data-verify-percent')).toBe(String(Math.round(MAX_SCALE * 100)));
    expect(root?.getAttribute('data-verify-at-max')).toBe('true');
    expect(root?.getAttribute('data-verify-at-min')).toBe('false');
  });

  it('各ボタンが対応するコールバックを呼ぶ', () => {
    const onZoomIn = vi.fn();
    const onZoomOut = vi.fn();
    const onReset = vi.fn();
    const onFit = vi.fn();
    renderControls(1, { onZoomIn, onZoomOut, onReset, onFit });

    fireEvent.click(zoomIn());
    fireEvent.click(zoomOut());
    fireEvent.click(reset());
    fireEvent.click(button('全体を表示'));

    expect(onZoomIn).toHaveBeenCalledTimes(1);
    expect(onZoomOut).toHaveBeenCalledTimes(1);
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(onFit).toHaveBeenCalledTimes(1);
  });

  it('無効なボタンはコールバックを呼ばない', () => {
    const onZoomIn = vi.fn();
    renderControls(MAX_SCALE, { onZoomIn });
    fireEvent.click(zoomIn());
    expect(onZoomIn).not.toHaveBeenCalled();
  });
});
