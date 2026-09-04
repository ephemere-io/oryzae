import { describe, expect, it } from 'vitest';
import {
  createMaterials,
  DARK_PALETTE,
  LIGHT_PALETTE,
  paletteFor,
} from '@/features/shared/study/scene/materials';

describe('paletteFor', () => {
  it('テーマで地と線の役を入れ替える', () => {
    expect(paletteFor('light')).toBe(LIGHT_PALETTE);
    expect(paletteFor('dark')).toBe(DARK_PALETTE);
  });

  it('どちらのテーマでも地と線の明度が十分に離れている', () => {
    // 線画なので、地と線が近づくと絵が消える。
    for (const palette of [LIGHT_PALETTE, DARK_PALETTE]) {
      expect(Math.abs(luminance(palette.solid) - luminance(palette.ink))).toBeGreaterThan(0.4);
    }
  });

  it('コルクにテラコッタを使わない（静けさで見せる）', () => {
    // #D4714E はブランドのテラコッタ。書斎では未読バッジも含めて使わない。
    expect(LIGHT_PALETTE.cork.toUpperCase()).not.toBe('#D4714E');
    expect(DARK_PALETTE.cork.toUpperCase()).not.toBe('#D4714E');
  });
});

describe('createMaterials', () => {
  it('同じ不透明度の faint / xray は使い回す', () => {
    const materials = createMaterials('light');
    expect(materials.faint(0.24)).toBe(materials.faint(0.24));
    expect(materials.faint(0.24)).not.toBe(materials.faint(0.18));
    expect(materials.xray(0.5)).toBe(materials.xray(0.5));
    materials.dispose();
  });

  it('faint と xray は同じ不透明度でも別物（深度の扱いが違う）', () => {
    const materials = createMaterials('light');
    expect(materials.faint(0.5)).not.toBe(materials.xray(0.5));
    materials.dispose();
  });

  it('xray は深度を見ない（瓶の中身が瓶体に隠れないように）', () => {
    const materials = createMaterials('light');
    const xray = materials.xray(0.5);
    expect(xray.depthTest).toBe(false);
    expect(xray.depthWrite).toBe(false);
    // 一方 faint は通常どおり深度を見る。
    expect(materials.faint(0.5).depthTest).toBe(true);
    materials.dispose();
  });

  it('当たり判定の面は見えない', () => {
    const materials = createMaterials('light');
    expect(materials.hitbox.visible).toBe(false);
    materials.dispose();
  });

  it('面は polygonOffset を持つ（線が面に負けてちらつかない）', () => {
    const materials = createMaterials('light');
    for (const material of [materials.solid, materials.paper, materials.cork]) {
      expect(material.polygonOffset).toBe(true);
    }
    materials.dispose();
  });

  it('dispose で作った素材を全部捨てる', () => {
    const materials = createMaterials('light');
    const tracked = [materials.solid, materials.ink, materials.faint(0.3), materials.xray(0.2)];
    const disposed: unknown[] = [];
    for (const material of tracked) {
      material.addEventListener('dispose', () => disposed.push(material));
    }

    materials.dispose();

    expect(disposed).toHaveLength(tracked.length);
  });

  it('dispose 後に取り直すと新しい素材になる（捨てたものを配らない）', () => {
    const materials = createMaterials('light');
    const before = materials.faint(0.3);
    materials.dispose();
    expect(materials.faint(0.3)).not.toBe(before);
    materials.dispose();
  });
});

/** #RRGGBB の相対輝度をおおまかに。色の比較にしか使わないので近似で足りる。 */
function luminance(hex: string): number {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = ((value >> 16) & 0xff) / 255;
  const g = ((value >> 8) & 0xff) / 255;
  const b = (value & 0xff) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
