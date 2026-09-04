import { describe, expect, it } from 'vitest';
import { fitRingText, RING_INSET } from '@/features/sp/fermentation/ring-text';

describe('fitRingText', () => {
  it('短い問いはそのまま出る', () => {
    const { label, truncated } = fitRingText('今日は？', 150);
    expect(label).toBe('今日は？');
    expect(truncated).toBe(false);
  });

  it('SP で読める大きさを保つ（小さい円でも 12px を下回らない）', () => {
    expect(fitRingText('問い', 60).fontSize).toBeGreaterThanOrEqual(12);
    expect(fitRingText('問い', 20).fontSize).toBeGreaterThanOrEqual(12);
  });

  it('大きい円でも肥大しない（円周の飾りであって見出しではない）', () => {
    expect(fitRingText('問い', 600).fontSize).toBeLessThanOrEqual(17);
  });

  it('入りきらない問いは末尾を「…」に畳む（黙って切れない）', () => {
    const long = 'あ'.repeat(200);
    const { label, truncated } = fitRingText(long, 150);
    expect(truncated).toBe(true);
    expect(label.endsWith('…')).toBe(true);
    expect(label.length).toBeLessThan(long.length);
  });

  it('畳んだ文字列は円周に収まる（字送りを含めても超えない）', () => {
    const long = 'あ'.repeat(200);
    const { label, fontSize } = fitRingText(long, 150);
    const circumference = Math.PI * (150 - RING_INSET * 2);
    expect(label.length * fontSize * 1.08).toBeLessThanOrEqual(circumference);
  });

  it('円が大きいほど多く入る', () => {
    const long = 'あ'.repeat(200);
    const small = fitRingText(long, 120).label.length;
    const large = fitRingText(long, 320).label.length;
    expect(large).toBeGreaterThan(small);
  });

  it('前後の空白は落とす（textPath の始点がずれる）', () => {
    expect(fitRingText('  問い  ', 150).label).toBe('問い');
  });

  it('空文字でも落ちない', () => {
    expect(fitRingText('', 150)).toEqual({ label: '', fontSize: 15, truncated: false });
  });

  it('直径 0 でも落ちない（初回レイアウト前に呼ばれうる）', () => {
    const { label, fontSize } = fitRingText('問い', 0);
    expect(fontSize).toBeGreaterThan(0);
    expect(label).toBe('…');
  });
});
