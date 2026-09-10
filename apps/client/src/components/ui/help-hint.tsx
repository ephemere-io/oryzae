'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useId, useState } from 'react';

interface HelpHintProps {
  /** 何を説明するのか。読み上げの名前にも使う（「〜について」）。 */
  subject: string;
  /** 説明そのもの。1〜2文で、**何が起きるか**を言う。 */
  text: string;
}

/**
 * 名前の隣に置く「？」。触れると意味が出る。
 *
 * 設定の並びには「時間内包」「音量内包」のように、**名前だけでは何が起きるか分からない**
 * ものがある。名前を長くすると行が窮屈になり、常に説明を出すと設定の一覧が読めなくなる。
 * 知りたい人だけが触れば出る、という置き方にする。
 *
 * ## ホバーだけにしない
 *
 * キーボードで辿る人には hover が無い。focus でも同じように出す。
 * 「？」自体はボタンにして Tab で届くようにし、押しても（focus が残るので）出たままになる。
 *
 * ## 出る向き
 *
 * 設定の面は幅が狭い（19rem）ので、右へ出すと画面の外へ切れる。**左へ開く**。
 * 説明は折り返す——1行に収めようとすると、書ける中身が名前の言い換えまで縮む。
 */
export function HelpHint({ subject, text }: HelpHintProps) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <span className="relative inline-flex shrink-0 items-center">
      <button
        type="button"
        aria-label={subject}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="flex h-[15px] w-[15px] items-center justify-center rounded-full border text-[10px] leading-none transition-colors"
        style={{
          borderColor: 'var(--border-subtle)',
          color: 'var(--date-color)',
        }}
        {...verifyAttrs({ unit: 'HelpHint', open, subject })}
      >
        ?
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="pointer-events-none absolute top-1/2 right-full z-[80] mr-2 w-[15rem] -translate-y-1/2 rounded-md px-2.5 py-2 text-[11px] leading-[1.7] shadow-md"
          style={{
            background: 'var(--fg)',
            color: 'var(--bg)',
            fontFamily: 'Inter, "Noto Sans JP", sans-serif',
          }}
        >
          {text}
        </span>
      )}
    </span>
  );
}
