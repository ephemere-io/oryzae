/**
 * 本文に差し込んだ直後の写真の置き方。
 *
 * **既定を美しくする。** 以前は「行頭・小さいまま」で入り、使う人が毎回 4 つの
 * 回り込み設定と 8 つのハンドルを試して整え直す必要があった。差し込んだ瞬間に
 * 読める姿になっているべきで、細かい調整は**したい人だけ**がするもの。
 */

/** 行の向きと写真の長辺が揃っているときの大きさ（1 行に対する割合）。 */
const ALONG_THE_LINE = 0.8;

/** 揃っていないときの大きさ。長辺が行を横切るので、同じ割合だと紙を覆ってしまう。 */
const ACROSS_THE_LINE = 0.5;

/** これより 1 に近い縦横比は「正方形」として扱う。 */
const SQUARE_TOLERANCE = 0.05;

/**
 * 差し込んだ直後の大きさを、**写真の向きと書字方向の関係**から決める。
 *
 * `widthRatio` は `inline-size`（＝1 行に対する割合）として当たるので、横書きでは
 * 横幅、縦書きでは縦幅を指す。だから同じ 1 本の規則で両方を言い切れる:
 * **写真の長辺が行と同じ向きなら 80%、行を横切る向きなら 50%。**
 *
 * - 横書き … 横長の写真は横幅 80%、縦長の写真は横幅 50%
 * - 縦書き … 縦長の写真は縦幅 80%、横長の写真は縦幅 50%
 *
 * @param aspect 写真の 高さ ÷ 幅。1 より大きければ縦長。
 * @param isVertical 縦書きか。
 */
export function defaultWidthRatio(aspect: number, isVertical: boolean): number {
  // 測れなかった写真（読み込み失敗・0 除算）は、行を横切る側に倒して紙を守る。
  if (!Number.isFinite(aspect) || aspect <= 0) return ACROSS_THE_LINE;
  // ほぼ正方形の写真は、どちらの向きにも「長辺」が無い。80% にすると行の向きと
  // 交わる側も同じだけ伸びて紙を覆うので、控えめな側に倒す。
  if (Math.abs(aspect - 1) < SQUARE_TOLERANCE) return ACROSS_THE_LINE;
  const isPortrait = aspect > 1;
  // 縦書きの行は縦に走るので、縦長の写真が「行と同じ向き」になる。
  const alongTheLine = isVertical ? isPortrait : !isPortrait;
  return alongTheLine ? ALONG_THE_LINE : ACROSS_THE_LINE;
}

/**
 * 写真の縦横比（高さ ÷ 幅）を読む。
 *
 * 差し込む前に知りたい: 大きさは向きで決まるので、貼ってから測って直すと
 * 目の前で一度跳ねる。読み込めなければ 0 を返し、呼び出し側が既定に倒す。
 */
export function loadAspect(url: string): Promise<number> {
  return new Promise((resolve) => {
    if (!url) {
      resolve(0);
      return;
    }
    const probe = new Image();
    probe.onload = () => {
      resolve(probe.naturalWidth > 0 ? probe.naturalHeight / probe.naturalWidth : 0);
    };
    probe.onerror = () => resolve(0);
    probe.src = url;
  });
}
