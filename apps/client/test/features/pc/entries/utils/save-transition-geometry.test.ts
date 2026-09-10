import { afterEach, describe, expect, it, vi } from 'vitest';
import { findJarDestination } from '@/features/pc/entries/utils/save-transition-geometry';

/**
 * 漬け込みの演出で字が吸い込まれる先。
 *
 * ここを取り違えると「変なところにズームアップされて、瓶に入っていくように見えない」
 * という壊れ方になる。**画面の中央を決め打ちにしない**ことを主に見張る。
 */
describe('findJarDestination', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    document.documentElement.style.removeProperty('--sidebar-width');
    vi.restoreAllMocks();
  });

  /** jsdom は実寸を持たないので、要素ごとに矩形を差し込む。 */
  function place(el: Element, rect: { left: number; top: number; w: number; h: number }): void {
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
      left: rect.left,
      top: rect.top,
      right: rect.left + rect.w,
      bottom: rect.top + rect.h,
      width: rect.w,
      height: rect.h,
      x: rect.left,
      y: rect.top,
      toJSON: () => ({}),
    });
  }

  function addUnit(
    unit: string,
    rect: { left: number; top: number; w: number; h: number },
    questionId?: string,
  ) {
    const el = document.createElement('div');
    el.setAttribute('data-verify-unit', unit);
    if (questionId) el.setAttribute('data-verify-question-id', questionId);
    document.body.appendChild(el);
    place(el, rect);
    return el;
  }

  // ここが本筋。使う人が「瓶」と呼ぶのは発酵瓶そのもの。
  it('発酵瓶があれば、その**胴**を狙う（箱の中心＝首ではない）', () => {
    // 瓶の絵は上が細い首、下がふくらんだ胴。言葉が漂うのは胴。
    addUnit('JarVessel', { left: 200, top: 100, w: 500, h: 620 });

    const d = findJarDestination();

    expect(d.x).toBe(450); // 横は箱の中心のまま
    expect(d.y).toBeCloseTo(100 + 620 * 0.71, 1); // 縦は胴の中心（箱の中心 410 より下）
    expect(d.y).toBeGreaterThan(100 + 620 / 2);
  });

  it('発酵瓶は問いの円より優先する', () => {
    addUnit('QuestionCircle', { left: 480, top: 350, w: 60, h: 60 }, 'mine');
    addUnit('JarVessel', { left: 0, top: 0, w: 500, h: 620 });

    const d = findJarDestination('mine');

    expect(d.x).toBe(250);
  });

  it('輪は瓶の胴に収まる大きさになる（1点に重ねない・はみ出さない）', () => {
    addUnit('JarVessel', { left: 200, top: 100, w: 500, h: 620 });

    const d = findJarDestination();

    // 胴の幅（500 × 0.71 = 355）の半分より内側。
    expect(d.radius).toBeGreaterThan(24);
    expect(d.radius).toBeLessThan((500 * 0.71) / 2);
  });

  // ここが本筋。書いたものはその問いに納まるので、狙いは問いで確定する。
  it('漬け込んだ問いの瓶を狙う（近さでは選ばない）', () => {
    // 画面の中心にいちばん近いのは別の問いの瓶。それでも自分の問いへ飛ぶ。
    addUnit('QuestionCircle', { left: 480, top: 350, w: 60, h: 60 }, 'other');
    addUnit('QuestionCircle', { left: 20, top: 20, w: 100, h: 100 }, 'mine');

    const d = findJarDestination('mine');

    expect(d.x).toBe(70);
    expect(d.y).toBe(70);
  });

  it('その問いの瓶がまだ描かれていなければ、近い瓶に落とす（字を消さない）', () => {
    addUnit('QuestionCircle', { left: 480, top: 350, w: 60, h: 60 }, 'other');

    const d = findJarDestination('mine');

    expect(d.x).toBe(510);
    expect(d.y).toBe(380);
  });

  it('瓶（問いの円）があれば、その中心へ吸い込む', () => {
    addUnit('QuestionCircle', { left: 400, top: 200, w: 200, h: 200 });

    const d = findJarDestination();

    expect(d.x).toBe(500);
    expect(d.y).toBe(300);
  });

  it('輪の大きさは瓶の大きさに従う（1点に重ねない）', () => {
    addUnit('QuestionCircle', { left: 0, top: 0, w: 200, h: 200 });
    const big = findJarDestination().radius;

    document.body.innerHTML = '';
    addUnit('QuestionCircle', { left: 0, top: 0, w: 100, h: 100 });
    const small = findJarDestination().radius;

    expect(big).toBeGreaterThan(small);
  });

  it('瓶が複数あるときは、画面の中心にいちばん近いものを選ぶ', () => {
    // jsdom の既定は 1024x768。中心は (512, 384)。
    addUnit('QuestionCircle', { left: 20, top: 20, w: 40, h: 40 }); // 遠い
    addUnit('QuestionCircle', { left: 480, top: 350, w: 60, h: 60 }); // 近い

    const d = findJarDestination();

    expect(d.x).toBe(510);
    expect(d.y).toBe(380);
  });

  it('大きさの無い瓶は選ばない（描画前の要素に吸い込まれない）', () => {
    addUnit('QuestionCircle', { left: 500, top: 380, w: 0, h: 0 });
    addUnit('QuestionCircle', { left: 100, top: 100, w: 80, h: 80 });

    const d = findJarDestination();

    expect(d.x).toBe(140);
    expect(d.y).toBe(140);
  });

  it('瓶が画面の外にあっても、吸い込み先は画面の中に留める', () => {
    // 前回のパン・ズームが復元されて瓶が流れているとき。そのまま吸い込むと
    // 字が画面の外で消えて、何も起きなかったように見える。
    addUnit('QuestionCircle', { left: 3000, top: -900, w: 200, h: 200 });

    const d = findJarDestination();

    expect(d.x).toBeLessThanOrEqual(1024);
    expect(d.x).toBeGreaterThanOrEqual(0);
    expect(d.y).toBeLessThanOrEqual(768);
    expect(d.y).toBeGreaterThanOrEqual(0);
  });

  it('瓶がまだ描かれていなければ、瓶の画面ぜんたいの中心へ', () => {
    addUnit('JarView', { left: 80, top: 0, w: 920, h: 700 });

    const d = findJarDestination();

    expect(d.x).toBe(540);
    expect(d.y).toBe(350);
  });

  it('瓶の画面にまだ着いていなければ、**サイドバーを除いた**紙の中央へ', () => {
    // 画面の中央（512）に落とすと、サイドバーのぶん左にずれる。
    document.documentElement.style.setProperty('--sidebar-width', '240px');

    const d = findJarDestination();

    expect(d.x).toBe(240 + (1024 - 240) / 2);
    expect(d.y).toBe(768 / 2);
  });

  it('サイドバーの幅が読めなくても落ちない（0 として扱う）', () => {
    const d = findJarDestination();

    expect(d.x).toBe(512);
    expect(Number.isFinite(d.radius)).toBe(true);
  });
});
