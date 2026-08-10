/**
 * 瓶（JarView）の形の定数。JarView 本体とスケルトンの両方が使う。
 *
 * ここに切り出しているのは、スケルトンが「本物と同じ輪郭」を出すため。瓶は /jar 画面その
 * ものなので、輪郭がズレると読み込み完了時に画面の主役が動いて見える。かといって
 * スケルトンから jar-view.tsx を import すると、ロード枠のためだけに巨大なコンポーネントを
 * 読み込むことになる（枠を早く出す目的と矛盾する）。
 */

/** 瓶のガラス本体の SVG path（viewBox `0 0 480 600`）。 */
export const JAR_PATH =
  'M190,100 C190,60 290,60 290,100 C290,130 270,140 270,170 C270,270 410,330 410,480 C410,580 70,580 70,480 C70,330 210,270 210,170 C210,140 190,130 190,100 Z';

/** 瓶の描画枠（JarView の中央イラストと同じ寸法・位置）。 */
export const JAR_BOX = {
  left: '50%',
  top: '45%',
  transform: 'translate(-50%, -55%)',
  width: '420px',
  height: '520px',
} as const;

/**
 * 問いの円（QuestionCircle）の既定配置。DB に jar_x/jar_y が無いときの落とし先で、
 * 未ドラッグのユーザーには常にこの位置に出る。単位はコンテナに対する百分率。
 */
export const CIRCLE_FALLBACK_POSITIONS: ReadonlyArray<{ x: number; y: number }> = [
  { x: 80, y: 22 }, // top-right
  { x: 72, y: 72 }, // bottom center-right
  { x: 14, y: 46 }, // center-left
];

/** QuestionCircle の直径（px）。 */
export const CIRCLE_SIZE = 280;

/** 盤面の背景（グリッド＋放射グラデ）。データに依存しないのでスケルトンでも本物を描く。 */
export const JAR_GRID_BACKGROUND =
  'linear-gradient(rgba(140,133,126,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(140,133,126,0.04) 1px, transparent 1px)';

export const JAR_RADIAL_BACKGROUND =
  'radial-gradient(circle at 50% 40%, rgba(255,255,255,0.7) 0%, transparent 70%)';
