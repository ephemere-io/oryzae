'use client';

import { verifyAttrs } from '@oryzae/verify';
import Link from 'next/link';
import {
  ELEVATED_CHIP_CLASS,
  ELEVATED_CHIP_STYLE,
  HEADER_CHIP_CLASS,
  ICON_STROKE_WIDTH,
  SHELL_INSET,
  SHELL_ROW_HEIGHT,
} from '@/components/ui/surface';
import { useBackLink } from '@/lib/back-link-context';

/**
 * 画面の左上の「‹ 書斎」。行き先・文言・記号は `BackLinkProvider` から受け取り、無ければ描かない。
 *
 * ### なぜ浮かせずにヘッダーへ入れるのか
 *
 * PC の出口は「左上のマーク → 下端の中央 → 上端の中央から垂れるタブ」と動いてきた。
 * 左上をやめた理由は場所ではなく**作り方**だった。シェルが画面の上に浮かせ、各画面に
 * 席を空けさせていたので、席を読む場所が 7 か所に増え、3 回読み忘れて重なった。
 * 上端の中央へ逃がしたタブは重ならなかったが、どの画面にも属さない札が真ん中に
 * 貼られ続け、「アプリの期待値として違和感がある」と言われた。
 *
 * だから**画面が自分のヘッダーの先頭に置く**。流れの中にあるので重なりようが無く、
 * 席を空ける取り決め（CSS 変数）も要らない。
 *
 * - `inline`: ヘッダーの行に並べる（エントリー・ボード）
 * - `corner`: ヘッダーを持たない画面の左上に置く（瓶・問いの変遷・アカウント）。
 *   位置はエントリーのヘッダー行と同じ線（上 `SHELL_INSET`・左 `SHELL_INSET * 2`・
 *   行の高さ `SHELL_ROW_HEIGHT`）で、画面を渡っても出口が同じ所にある
 *
 * ### 見た目
 *
 * **隣に並ぶ「問いを紐づける」と同じボタン**（寸法 `HEADER_CHIP_CLASS`・面 `ELEVATED_CHIP_*`）
 * で、縁だけを深い緑（`--accent`）にする。面を持たない文字だけの版は「問いを紐づける」と
 * 並ぶと別の部品に見えた（オーナーの判断）。並びは「‹ 書斎 ＋ 書斎の絵」。絵を山形の隣に
 * 置くと記号が 2 つ続いて窮屈なので、名前の後ろに添える。絵の色も縁と同じ緑。
 */
export function BackLink({ placement = 'inline' }: { placement?: 'inline' | 'corner' }) {
  const target = useBackLink();
  if (target === null) return null;

  const link = (
    <Link
      href={target.href}
      aria-label={target.ariaLabel}
      {...verifyAttrs({ unit: 'BackLink', placement, hasIcon: Boolean(target.icon) })}
      className={`${HEADER_CHIP_CLASS} ${ELEVATED_CHIP_CLASS}`}
      style={{ ...ELEVATED_CHIP_STYLE, borderColor: 'var(--accent)' }}
    >
      <svg
        aria-hidden="true"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
        // 山形の描画は 24 の枠の 9〜15 にしか無く、左右に 6px ずつ空きがある。
        // そのぶん詰めて、縁から山形・山形から名前の見た目の間隔を余白と揃える。
        className="-mx-1.5 shrink-0"
      >
        <path d="m15 18-6-6 6-6" />
      </svg>
      {/* **字だけ 1px 上げる。** 日本語の字面は行の箱の中で下に寄るので、中央揃えだと
          山形より 0.75px 低く見える（画素で測った。1px 上げると差は 0.25px）。
          0.5px は画素に丸められて効かない。 */}
      <span className="relative -top-px whitespace-nowrap">{target.label}</span>
      {target.icon ? (
        // 絵の枠の左右に空きがある（左 4px・右 2px）。名前に寄せ、縁までの見た目の余白を
        // 山形の側と揃える。
        <span
          aria-hidden="true"
          className="-mr-0.5 -ml-1 flex shrink-0"
          style={{ color: 'var(--accent)' }}
        >
          {target.icon}
        </span>
      ) : null}
    </Link>
  );

  if (placement === 'inline') return link;

  return (
    // 重なり順は「問いの変遷」（右上）と同じ 55。発酵履歴の層（70）より下。
    <div
      className="fixed z-[55] flex items-center"
      style={{ top: SHELL_INSET, left: SHELL_INSET * 2, height: SHELL_ROW_HEIGHT }}
    >
      {link}
    </div>
  );
}
