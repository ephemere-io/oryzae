import { describe, expect, it } from 'vitest';
import { JAR_PATH, JAR_VIEWBOX, toUnitPath } from '@/features/shared/fermentation/jar-path';

describe('toUnitPath', () => {
  it('x は幅で、y は高さで割る', () => {
    expect(toUnitPath('M240,300', 480, 600)).toBe('M0.5,0.5');
  });

  it('コマンド文字と区切りはそのまま残す', () => {
    const unit = toUnitPath('M190,100 C190,60 290,60 290,100 Z', 480, 600);
    expect(unit.startsWith('M')).toBe(true);
    expect(unit.endsWith('Z')).toBe(true);
    expect(unit.split('C')).toHaveLength(2);
  });

  it('壜の輪郭が 0..1 に収まる（はみ出すと切り抜きが器からずれる）', () => {
    const unit = toUnitPath(JAR_PATH, JAR_VIEWBOX.width, JAR_VIEWBOX.height);
    const numbers = unit.match(/-?\d+(?:\.\d+)?/g) ?? [];
    expect(numbers.length).toBeGreaterThan(0);
    for (const value of numbers) {
      expect(Number(value)).toBeGreaterThanOrEqual(0);
      expect(Number(value)).toBeLessThanOrEqual(1);
    }
  });

  it('数値の個数が変わらない（座標を落とすと形が壊れる）', () => {
    const before = (JAR_PATH.match(/-?\d+(?:\.\d+)?/g) ?? []).length;
    const after = (
      toUnitPath(JAR_PATH, JAR_VIEWBOX.width, JAR_VIEWBOX.height).match(/-?\d+(?:\.\d+)?/g) ?? []
    ).length;
    expect(after).toBe(before);
  });

  it('壜の口は上のほう、底は下のほうにある（x と y を取り違えていない）', () => {
    const unit = toUnitPath(JAR_PATH, JAR_VIEWBOX.width, JAR_VIEWBOX.height);
    // 元パスの先頭は口の左肩 (190,100) → (0.39583, 0.16667)。
    expect(unit.startsWith('M0.39583,0.16667')).toBe(true);
    // 底は y=580 → 0.96667 が現れる。
    expect(unit).toContain('0.96667');
  });

  it('大きさが 0 でも落ちない（初回レイアウト前に呼ばれうる）', () => {
    expect(toUnitPath(JAR_PATH, 0, 600)).toBe(JAR_PATH);
    expect(toUnitPath(JAR_PATH, 480, 0)).toBe(JAR_PATH);
  });

  it('負の座標も符号を保つ', () => {
    expect(toUnitPath('M-240,-300', 480, 600)).toBe('M-0.5,-0.5');
  });
});
