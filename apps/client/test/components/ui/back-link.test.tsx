import { cleanup, render, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { BackLink } from '@/components/ui/back-link';
import { BackLinkProvider } from '@/lib/back-link-context';

const STUDY = { href: '/', label: '書斎', ariaLabel: '書斎に戻る' };

describe('BackLink', () => {
  // このリポジトリの vitest はテストの間に DOM を片付けないので、毎回外す。
  afterEach(cleanup);

  it('行き先が配られていなければ何も描かない（書斎そのもの・書斎が無効な間）', () => {
    const outside = render(<BackLink />);
    expect(outside.container.innerHTML).toBe('');

    const none = render(
      <BackLinkProvider value={null}>
        <BackLink placement="corner" />
      </BackLinkProvider>,
    );
    expect(none.container.innerHTML).toBe('');
  });

  it('行き先の名前を見せ、読み上げは動作まで言う', () => {
    const { container } = render(
      <BackLinkProvider value={STUDY}>
        <BackLink />
      </BackLinkProvider>,
    );
    const link = within(container).getByRole('link', { name: '書斎に戻る' });
    expect(link.getAttribute('href')).toBe('/');
    expect(link.textContent).toBe('書斎');
  });

  it('inline はヘッダーの流れに並ぶだけで、自分では位置を持たない', () => {
    const { container } = render(
      <BackLinkProvider value={STUDY}>
        <BackLink placement="inline" />
      </BackLinkProvider>,
    );
    // 浮かせると、また画面の側に席を空けさせることになる。
    expect(container.firstElementChild?.tagName).toBe('A');
    expect(container.innerHTML).not.toContain('fixed');
  });

  it('corner はヘッダーの無い画面の左上に、エントリーのヘッダー行と同じ線で置く', () => {
    const { container } = render(
      <BackLinkProvider value={STUDY}>
        <BackLink placement="corner" />
      </BackLinkProvider>,
    );
    const corner = container.firstElementChild;
    if (!(corner instanceof HTMLElement)) throw new Error('隅の箱が無い');
    expect(corner.className).toContain('fixed');
    // SHELL_INSET = 20 / SHELL_ROW_HEIGHT = 48（エントリーのヘッダーの上端・行の高さ・左の縦線）。
    expect(corner.style.top).toBe('20px');
    expect(corner.style.left).toBe('40px');
    expect(corner.style.height).toBe('48px');
  });
});
