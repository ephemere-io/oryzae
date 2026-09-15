'use client';

// verify-exempt: 状態を持たない表示だけの部品（押したときの振る舞いは親のフォームが持ち、フォームの検証で見る）。

import { ICON_STROKE_WIDTH } from '@/components/ui/surface';

/**
 * 紙の左上の、正円の「戻る」。SP の紙で入力欄を開いたあと、入り方を選ぶところへ戻る。
 *
 * モバイルの定位置（上段の左端・正円）に置く。文字の「戻る」を並べると、見出しの
 * 「Oryzae」より先に目に入って紙の名前が読めなくなる。
 */
export function PaperBackButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[rgba(122,116,64,0.24)] bg-white/70 text-[#5c4f3f] transition-colors duration-150 hover:bg-[#f3f0e8]"
    >
      <svg
        aria-hidden="true"
        width={16}
        height={16}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M15 5l-7 7 7 7" />
      </svg>
    </button>
  );
}
