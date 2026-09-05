/**
 * 書斎の素材（`docs/oryzae-study/20-3d-component.md`「素材」）。
 *
 * `scene/*` は three.js だけに依存し、React も Next も知らない。テストしやすくするためと、
 * 端末別の入口から同じ関数を共有するため。
 *
 * 面はすべて `MeshBasicMaterial`（ライト無し・影無し）。書斎は線画であって、
 * 陰影で立体を語らない。
 */

import {
  LineBasicMaterial,
  type Material,
  MeshBasicMaterial,
  SpriteMaterial,
  type Texture,
} from 'three';

/** 明暗どちらの地でも「紙の白」と「墨の線」の役だけを持つ 2 色。 */
export interface StudyPalette {
  /** 面の塗り（紙）。 */
  solid: string;
  /** 写真カードの塗り。solid よりわずかに白い。 */
  paper: string;
  /** 線（墨）。 */
  ink: string;
  /** 床の格子。 */
  grid: string;
  /** コルクの塗り。テラコッタは使わない。 */
  cork: string;
}

export const LIGHT_PALETTE: StudyPalette = {
  solid: '#FDFCF9',
  paper: '#FFFFFF',
  ink: '#1A1918',
  grid: '#E5E4E0',
  cork: '#F2EDE0',
};

/** ダークテーマでは地と線の役を入れ替える（20-3d-component.md）。 */
export const DARK_PALETTE: StudyPalette = {
  solid: '#1A1A1A',
  paper: '#242424',
  ink: '#CCCCCC',
  grid: '#2E2E2E',
  cork: '#3A362C',
};

export type StudyTheme = 'light' | 'dark';

export function paletteFor(theme: StudyTheme): StudyPalette {
  return theme === 'dark' ? DARK_PALETTE : LIGHT_PALETTE;
}

/**
 * シーンが使う素材一式。
 *
 * `dispose()` で全部まとめて捨てられるように 1 つの入れ物にしている。素材の破棄漏れは
 * 再マウントのたびに GPU 資源が積み上がる形で効いてくるが、画面には出ないので気づけない。
 */
export interface StudyMaterials {
  solid: MeshBasicMaterial;
  paper: MeshBasicMaterial;
  cork: MeshBasicMaterial;
  ink: LineBasicMaterial;
  grid: LineBasicMaterial;
  /** 床の格子。気配だけ残す濃度。 */
  gridFaint: LineBasicMaterial;
  /** 不透明度つきの線。同じ濃さは 1 つを使い回す。 */
  faint(opacity: number): LineBasicMaterial;
  /** 瓶の中身用。面より必ず手前に出る。 */
  xray(opacity: number): LineBasicMaterial;
  /** 当たり判定用の見えない面。 */
  hitbox: MeshBasicMaterial;
  sprite(map: Texture, opacity: number): SpriteMaterial;
  dispose(): void;
}

/** 不透明度をキーに使うので、浮動小数のゆらぎでキャッシュが効かなくならないよう丸める。 */
function opacityKey(opacity: number): string {
  return opacity.toFixed(3);
}

/** フェードで書き換える 2 つの値。元の状態は素材を作った時点で控えておく。 */
export interface FadeState {
  opacity: number;
  transparent: boolean;
}

/**
 * 素材を `fade`（0..1）まで薄くしたときの状態。
 *
 * **`transparent` を戻すのが肝。** three.js は透明な物を不透明な物とは別のパスで、
 * 奥から手前へ並べ替えて描く。元が不透明な瓶体を `transparent: true` のままにすると、
 * 瓶体が透明キューに入り、中の言葉（`depthTest: false` の sprite）より**後に**
 * 描かれることがある。そうなると言葉が瓶体に塗り潰されて消える
 * （実機で「一覧を開いて閉じると壜のキーワードが減る」として出ていた）。
 */
export function fadedMaterialState(base: FadeState, fade: number): FadeState {
  return {
    opacity: base.opacity * fade,
    // 薄くしている間だけ透明扱い。戻り切ったら元のフラグに返す。
    transparent: base.transparent || fade < 1,
  };
}

export function createMaterials(theme: StudyTheme): StudyMaterials {
  const palette = paletteFor(theme);
  const owned: Material[] = [];

  function own<T extends Material>(material: T): T {
    owned.push(material);
    return material;
  }

  // polygonOffset を入れるのは、面と線が同一平面に来たときに線が面へ負けて
  // ちらつくのを防ぐため（書斎は線が主役なので、線を必ず勝たせる）。
  const solid = own(
    new MeshBasicMaterial({
      color: palette.solid,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    }),
  );
  const paper = own(
    new MeshBasicMaterial({
      color: palette.paper,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    }),
  );
  const cork = own(
    new MeshBasicMaterial({
      color: palette.cork,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    }),
  );
  const ink = own(new LineBasicMaterial({ color: palette.ink }));
  const grid = own(new LineBasicMaterial({ color: palette.grid }));
  const gridFaint = own(
    new LineBasicMaterial({ color: palette.grid, transparent: true, opacity: 0.45 }),
  );
  const hitbox = own(new MeshBasicMaterial({ visible: false }));

  const faintCache = new Map<string, LineBasicMaterial>();
  const xrayCache = new Map<string, LineBasicMaterial>();

  return {
    solid,
    paper,
    cork,
    ink,
    grid,
    gridFaint,
    hitbox,
    faint(opacity: number): LineBasicMaterial {
      const key = opacityKey(opacity);
      const cached = faintCache.get(key);
      if (cached) return cached;
      const material = own(
        new LineBasicMaterial({ color: palette.ink, transparent: true, opacity }),
      );
      faintCache.set(key, material);
      return material;
    },
    xray(opacity: number): LineBasicMaterial {
      const key = opacityKey(opacity);
      const cached = xrayCache.get(key);
      if (cached) return cached;
      // 瓶の中身は不透明な瓶体に隠れる。深度を見ずに輪郭の内側へ重ねる（透視図の扱い）。
      // 瓶体そのものは不透明のままなので、奥のボードは透けない。
      const material = own(
        new LineBasicMaterial({
          color: palette.ink,
          transparent: true,
          opacity,
          depthTest: false,
          depthWrite: false,
        }),
      );
      xrayCache.set(key, material);
      return material;
    },
    sprite(map: Texture, opacity: number): SpriteMaterial {
      // スプライトは 1 枚ごとにテクスチャが違うのでキャッシュしない。
      return own(
        new SpriteMaterial({
          map,
          transparent: true,
          opacity,
          depthTest: false,
          depthWrite: false,
        }),
      );
    },
    dispose(): void {
      for (const material of owned) material.dispose();
      owned.length = 0;
      faintCache.clear();
      xrayCache.clear();
    },
  };
}
