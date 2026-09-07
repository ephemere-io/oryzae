/**
 * 書斎そのものを小さく描いたマーク（机の上に壜と手帳、奥に板）。
 *
 * 2 か所で同じ絵を使う:
 *  - 書斎の左上のブランドマーク（`StudyChrome`）
 *  - サブ画面の左上の「書斎へ戻る」（`BackToStudy`）
 *
 * 同じ絵にするのは、**戻り先が「さっきまで居たあの部屋」だと一目で繋がる**ようにするため。
 * 以前は書斎側だけが `o` の一文字で、実機レビューで「左上の 0（または O）の意味が分からない」
 * と報告された。片方だけ絵にしても、行き先と戻り先が同じ場所だと分からない。
 */

// verify-exempt: 状態も分岐も持たない装飾の SVG。2 か所で同じ絵になることは、この 1 ファイルを
// import している事実が保証するので、孤立検証で見るものが無い。検証ユニットにすると親
// （StudyChrome / BackToStudy）の subtree に契約が二重に出るだけになる。「左上が書斎の縮図で
// あること」は親側の invariant が `data-study-mark` で見る。

export interface StudyMarkProps {
  /** 一辺（px）。既定は左上に置くときの 20。 */
  size?: number;
}

export function StudyMark({ size = 20 }: StudyMarkProps) {
  return (
    <svg
      data-study-mark
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      style={{ color: '#8EA89C' }}
    >
      {/* 奥の板 */}
      <rect
        x="11.4"
        y="3.2"
        width="6"
        height="4.6"
        rx="0.4"
        stroke="currentColor"
        strokeWidth="0.9"
        opacity="0.55"
      />
      {/* 机の天板 */}
      <path d="M1.8 14.2H18.2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      {/* 壜（首とふくらみ） */}
      <path
        d="M6.1 6.4V8.1C6.1 9.2 4.6 9.9 4.6 11.6C4.6 13.1 5.7 14.1 7.3 14.1C8.9 14.1 10 13.1 10 11.6C10 9.9 8.5 9.2 8.5 8.1V6.4"
        stroke="currentColor"
        strokeWidth="0.9"
        strokeLinejoin="round"
      />
      <path d="M5.7 6.4H8.9" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" />
      {/* 机に積んだ手帳 */}
      <path
        d="M11.6 14.1V12.4H17.1V14.1"
        stroke="currentColor"
        strokeWidth="0.9"
        strokeLinejoin="round"
      />
      <path d="M11.9 13.2H16.8" stroke="currentColor" strokeWidth="0.7" opacity="0.6" />
    </svg>
  );
}
