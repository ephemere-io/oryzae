import { describe, expect, it } from 'vitest';
import { placeHint } from '@/components/ui/help-hint-placement';

// 数字は実寸に合わせてある: 1440×800 の窓で、設定パネル（19rem）が右上に開いたところ。
// 「？」は名前のすぐ後ろ、パネルの左寄りにある。
const VIEWPORT = { width: 1440, height: 800 };
const PANEL = { left: 1096, top: 70, right: 1400, bottom: 784 };

function anchorAt(left: number, top: number) {
  return { left, top, right: left + 15, bottom: top + 15 };
}

const heightOf = (h: number) => () => h;

describe('placeHint', () => {
  it('「？」の右に出し、パネルの右の縁で止める', () => {
    const p = placeHint({
      anchor: anchorAt(1175, 300),
      bounds: PANEL,
      viewport: VIEWPORT,
      measureHeight: heightOf(100),
    });
    expect(p.side).toBe('right');
    expect(p.left).toBe(1175 + 15 + 8);
    expect(p.left + p.width).toBeLessThanOrEqual(PANEL.right - 8);
  });

  it('「？」の高さの中央に揃う', () => {
    const p = placeHint({
      anchor: anchorAt(1175, 300),
      bounds: PANEL,
      viewport: VIEWPORT,
      measureHeight: heightOf(100),
    });
    expect(p.top + 100 / 2).toBe(300 + 15 / 2);
  });

  it('窓の下端に掛かるなら、上へずらして窓の中に収める', () => {
    const p = placeHint({
      anchor: anchorAt(1175, 770),
      bounds: PANEL,
      viewport: VIEWPORT,
      measureHeight: heightOf(120),
    });
    expect(p.side).toBe('right');
    expect(p.top + 120).toBeLessThanOrEqual(VIEWPORT.height - 8);
  });

  it('右に十分な幅が無ければ、下に出す（パネルの幅の中で）', () => {
    const p = placeHint({
      anchor: anchorAt(1300, 300),
      bounds: PANEL,
      viewport: VIEWPORT,
      measureHeight: heightOf(80),
    });
    expect(p.side).toBe('below');
    expect(p.top).toBe(300 + 15 + 8);
    expect(p.left).toBeGreaterThanOrEqual(PANEL.left + 8);
    expect(p.left + p.width).toBeLessThanOrEqual(PANEL.right - 8);
  });

  it('下にも入らなければ上に出す', () => {
    const p = placeHint({
      anchor: anchorAt(1300, 760),
      bounds: PANEL,
      viewport: VIEWPORT,
      measureHeight: heightOf(80),
    });
    expect(p.side).toBe('above');
    expect(p.top + 80).toBeLessThanOrEqual(760 - 8);
  });

  it('高さは、決めた幅で測る（折り返しで高さが変わるため）', () => {
    const widths: number[] = [];
    const p = placeHint({
      anchor: anchorAt(1175, 300),
      bounds: PANEL,
      viewport: VIEWPORT,
      measureHeight: (w) => {
        widths.push(w);
        return 60;
      },
    });
    expect(widths).toEqual([p.width]);
  });

  it('載っている面が無ければ、窓を縁にする', () => {
    const p = placeHint({
      anchor: anchorAt(100, 300),
      bounds: null,
      viewport: VIEWPORT,
      measureHeight: heightOf(60),
    });
    expect(p.side).toBe('right');
    expect(p.width).toBe(240);
  });
});
