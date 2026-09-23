import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { InlineImageDropIndicator } from '@/features/pc/entries/components/inline-image-drop-indicator';

// 「指していないときは何も描かない」は、契約のノードごと消えるので孤立検証には載らない。
// ここで押さえる。線が出たままだと、運び終わったあとに本文へ細い棒が残る。

afterEach(cleanup);

describe('InlineImageDropIndicator', () => {
  it('落ちる先が無いときは何も描かない', () => {
    const { container } = render(<InlineImageDropIndicator rect={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('落ちる先があれば線を描く', () => {
    const rect = {
      x: 10,
      y: 20,
      width: 0,
      height: 24,
      left: 10,
      top: 20,
      right: 10,
      bottom: 44,
      toJSON: () => ({}),
    };
    const { container } = render(<InlineImageDropIndicator rect={rect} />);
    const line = container.querySelector<HTMLElement>(
      '[data-verify-unit="InlineImageDropIndicator"]',
    );

    expect(line).not.toBeNull();
    // 横書きのキャレット（幅 0）なので、縦に立つ。
    expect(line?.style.height).toBe('24px');
    expect(line?.style.left).toBe('10px');
  });
});
