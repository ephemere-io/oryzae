'use client';

import { verifyAttrs } from '@oryzae/verify';
import Link from 'next/link';
import {
  HOVER_CLASS,
  ICON_STROKE_WIDTH,
  SHELL_INSET,
  SHELL_ROW_HEIGHT,
} from '@/components/ui/surface';
import { useBackLink } from '@/lib/back-link-context';

/**
 * 画面の左上の「‹ 書斎」。行き先と文言は `BackLinkProvider` から受け取り、無ければ描かない。
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
 * 面も縁も持たない。名前と山形だけの文字で、ホバーで地が沈む（`HOVER_CLASS`）。
 * 問いのチップや「問いの変遷」と同じ面にすると、道具が 1 つ増えたように見える。
 * 出口は道具ではなく、画面の見出しの一部として読ませる。
 *
 * 見える名前は行き先だけ（「書斎」）。iOS の戻ると同じで、山形が「戻る」を言う。
 */
export function BackLink({ placement = 'inline' }: { placement?: 'inline' | 'corner' }) {
  const target = useBackLink();
  if (target === null) return null;

  const link = (
    <Link
      href={target.href}
      aria-label={target.ariaLabel}
      {...verifyAttrs({ unit: 'BackLink', placement })}
      // 山形の左に 6px の遊びを持たせ、そのぶん外へ出す。字と山形が行の縦線に乗り、
      // ホバーの地だけが線の外へはみ出す。高さは問いのチップ（36px）と揃える。
      className={`-ml-1.5 flex h-9 shrink-0 items-center gap-1 rounded-full pr-3 pl-1.5 text-[13px] tracking-[0.06em] ${HOVER_CLASS}`}
      style={{ color: 'var(--fg)' }}
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
      >
        <path d="m15 18-6-6 6-6" />
      </svg>
      <span className="whitespace-nowrap">{target.label}</span>
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
