import { describe, expect, it } from 'vitest';
import {
  createMaterials,
  DARK_PALETTE,
  fadedMaterialState,
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

describe('fadedMaterialState', () => {
  const opaque = { opacity: 1, transparent: false };
  const glassy = { opacity: 0.5, transparent: true };

  it('元の不透明度に倍率を掛ける', () => {
    expect(fadedMaterialState(opaque, 0.4).opacity).toBeCloseTo(0.4, 10);
    expect(fadedMaterialState(glassy, 0.4).opacity).toBeCloseTo(0.2, 10);
  });

  it('薄くしている間は透明扱いにする（そうしないと薄くならない）', () => {
    expect(fadedMaterialState(opaque, 0.4).transparent).toBe(true);
    expect(fadedMaterialState(opaque, 0.999).transparent).toBe(true);
  });

  it('戻し切ったら元の不透明さに返す', () => {
    // ここが要。three.js は透明な物を別のパスで奥から手前へ並べ替えて描くので、
    // 不透明な瓶体を透明扱いのままにすると、中の言葉（depthTest:false の sprite）を
    // **後から**塗り潰して消してしまう。
    expect(fadedMaterialState(opaque, 1)).toEqual({ opacity: 1, transparent: false });
  });

  it('元から透明な素材は戻しても透明のまま', () => {
    expect(fadedMaterialState(glassy, 1)).toEqual({ opacity: 0.5, transparent: true });
  });

  it('0 まで薄くできる（SP のボードで瓶を消す経路）', () => {
    expect(fadedMaterialState(opaque, 0)).toEqual({ opacity: 0, transparent: true });
  });

  it('往復しても元に戻る（薄く → 戻す を繰り返しても劣化しない）', () => {
    let state = { ...opaque };
    for (const fade of [0.5, 0, 1, 0.2, 1]) {
      state = fadedMaterialState(opaque, fade);
    }
    expect(state).toEqual(opaque);
  });
});
