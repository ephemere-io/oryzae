/**
 * 壜の輪郭（SVG パス）と、それを大きさに依らない切り抜きへ直す変換。
 *
 * **なぜ変換が要るか。** CSS の `clip-path: path(...)` は座標を**絶対 px** で解釈する。
 * 壜の絵は viewBox 480x600 を器の大きさに合わせて伸縮するので、器が 480x600 から
 * 離れるほど「絵の壜」と「切り抜きの壜」がずれる。PC（500x620）ではほぼ一致していて
 * 気づかなかったが、SP（幅 240 前後）では切り抜きが壜の 2 倍の大きさになり、
 * 中に漂わせた言葉が壜の外へこぼれた。
 *
 * SVG の `clipPathUnits="objectBoundingBox"` は 0..1 の比率で切り抜くので、器が
 * どんな大きさでも絵と一致する。そのための正規化をここで行う。
 */

/** 壜の輪郭（viewBox 0 0 480 600 の座標系）。 */
export const JAR_PATH =
  'M190,100 C190,60 290,60 290,100 C290,130 270,140 270,170 C270,270 410,330 410,480 C410,580 70,580 70,480 C70,330 210,270 210,170 C210,140 190,130 190,100 Z';

/** 壜の絵が描かれる座標系。切り抜きの正規化に使う。 */
export const JAR_VIEWBOX = { width: 480, height: 600 } as const;

/**
 * 絶対座標のパスを 0..1 の比率へ直す（`clipPathUnits="objectBoundingBox"` 用）。
 *
 * このパスは M と C だけで出来ていて、数値はすべて x,y の対。数値を順に拾って
 * 交互に幅・高さで割れば比率になる。コマンド文字と区切りはそのまま残す。
 */
export function toUnitPath(path: string, width: number, height: number): string {
  if (width <= 0 || height <= 0) return path;
  let index = 0;
  return path.replace(/-?\d+(?:\.\d+)?/g, (number) => {
    const divisor = index % 2 === 0 ? width : height;
    index++;
    // 小数は 5 桁で足りる（480px 幅で 0.005px 未満の誤差）。
    return String(Math.round((Number(number) / divisor) * 1e5) / 1e5);
  });
}
