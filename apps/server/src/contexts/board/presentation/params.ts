/**
 * 盤面のエンドポイントが受け取るフォーム値の読み取り。
 *
 * ルート本体から切り出しているのは、値の妥当性判断がそれ自体でテストに値するため。
 * 「ルートを組み立てて叩く」より、入力と出力の対応をそのまま並べたほうが、
 * どこまでを信用しないと決めたのかが読み取れる。
 */

/**
 * 画像の実寸の上限。カードの縦横比を出すためだけの値なので、現実の写真より
 * 十分大きければよい。桁数で縛ることで、精度が落ちるような巨大な数も入口で消える。
 */
const MAX_IMAGE_DIMENSION = 20000;

/**
 * 画像の実寸（クライアントが自己申告する値）を受ける。
 *
 * 以前は `Number.isFinite(x) ? x : undefined` で済ませていたが、これは型を絞れない
 * うえ 0 や負値を素通しし、`Number.parseInt` の性質で `"12abc"` も 12 として通る。
 * 寸法はカードの縦横比の計算に使うだけなので、少しでも怪しければ捨てて既定値に
 * 任せるほうが安全。
 */
export function parseDimension(raw: unknown): number | undefined {
  if (typeof raw !== 'string') return undefined;
  // 検査と変換で同じ文字列を見る（trim した値を検査して未 trim を parse すると、
  // 「何を許したか」と「何を数にしたか」がずれる）。
  const trimmed = raw.trim();
  // 桁数まで縛る。数字だけでも 30 桁あれば Number にした時点で精度が落ちる。
  if (!/^\d{1,5}$/.test(trimmed)) return undefined;
  const value = Number.parseInt(trimmed, 10);
  return value > 0 && value <= MAX_IMAGE_DIMENSION ? value : undefined;
}

/**
 * 置き場所（world 座標）の上限。キャンバスは無限に広いが、実際に人が置ける
 * 範囲をはるかに超えた値は入力ミスか改竄なので、入口で捨てる。
 */
const MAX_WORLD_COORD = 1_000_000;

/**
 * カードを置く world 座標を受ける。
 *
 * 寸法と違い、**負の値も小数も正しい**（原点より左・上にも置ける）ので
 * `parseDimension` の「正の整数だけ」は使えない。ただし考え方は同じで、
 * 少しでも怪しい値は捨ててサーバー既定のランダム配置に任せる。
 * 正規表現で形を縛るのは、`Number.parseFloat` が `"12abc"` を 12 として通し、
 * `"1e999"` を Infinity にしてしまうため。
 */
export function parseWorldCoord(raw: unknown): number | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (!/^-?\d{1,7}(\.\d{1,6})?$/.test(trimmed)) return undefined;
  const value = Number.parseFloat(trimmed);
  return Number.isFinite(value) && Math.abs(value) <= MAX_WORLD_COORD ? value : undefined;
}
