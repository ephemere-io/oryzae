import { describe, expect, it } from 'vitest';
import {
  overlayToolbarInset,
  type ViewportSnapshot,
} from '@/features/shared/auth/entrance/viewport';

/** iPhone 15 Pro（縦）。画面は 393 × 852pt。 */
const IPHONE_SCREEN = { screenWidth: 393, screenHeight: 852 };

function snapshot(overrides: Partial<ViewportSnapshot> = {}): ViewportSnapshot {
  return {
    innerWidth: 393,
    innerHeight: 852,
    ...IPHONE_SCREEN,
    coarsePointer: true,
    standalone: false,
    ...overrides,
  };
}

describe('overlayToolbarInset', () => {
  it('アプリ内ブラウザ（ツールバーが画面に重なる）では、その高さぶんを空ける', () => {
    // Dia は Web ビューを画面いっぱい（852）に置き、ツールバーを上に重ねる。
    // svh も safe-area も画面の高さのままなので、ページからは隠れているのが分からない。
    const inset = overlayToolbarInset(snapshot());

    // 実測のツールバーは 76pt（スクリーンショットから）。それを覆える大きさであること。
    expect(inset).toBeGreaterThanOrEqual(76);
    // 覆えれば十分で、それ以上空けると下が間延びする。
    expect(inset).toBeLessThan(120);
  });

  it('ふつうのブラウザ（自分でツールバーをよける）では何も空けない', () => {
    // Safari は下のツールバーぶんを引いた高さを innerHeight / svh として教えてくれる。
    expect(overlayToolbarInset(snapshot({ innerHeight: 750 }))).toBe(0);
  });

  it('ホーム画面から開いた PWA では何も空けない（ツールバーが無い）', () => {
    expect(overlayToolbarInset(snapshot({ standalone: true }))).toBe(0);
  });

  it('マウスの環境では何も空けない（全画面表示のブラウザを誤検出しない）', () => {
    expect(
      overlayToolbarInset(
        snapshot({
          coarsePointer: false,
          innerWidth: 1512,
          innerHeight: 982,
          screenWidth: 1512,
          screenHeight: 982,
        }),
      ),
    ).toBe(0);
  });

  it('横向きでも、その向きの画面の辺で見分ける（iOS の screen は回しても入れ替わらない）', () => {
    const landscape = snapshot({ innerWidth: 852, innerHeight: 393 });
    expect(overlayToolbarInset(landscape)).toBeGreaterThan(0);
    // 横向きで高さの割合を見積もるので、縦向きより小さくなる。
    expect(overlayToolbarInset(landscape)).toBeLessThan(overlayToolbarInset(snapshot()));

    // 横向きでブラウザがよけている場合は 0。
    expect(overlayToolbarInset(snapshot({ innerWidth: 852, innerHeight: 330 }))).toBe(0);
  });

  it('画面の大きさが分からない環境では何もしない', () => {
    expect(overlayToolbarInset(snapshot({ screenWidth: 0, screenHeight: 0 }))).toBe(0);
    expect(overlayToolbarInset(snapshot({ innerHeight: 0 }))).toBe(0);
  });
});
