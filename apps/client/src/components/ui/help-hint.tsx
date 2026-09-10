'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { type HintPlacement, placeHint } from './help-hint-placement';
import { LAYER } from './surface';

interface HelpHintProps {
  /** 何を説明するのか。読み上げの名前にも使う（「〜について」）。 */
  subject: string;
  /** 説明そのもの。1〜2文で、**何が起きるか**を言う。 */
  text: string;
}

/**
 * 名前の隣に置く「？」。触れると意味が出る。
 *
 * 設定の並びには「時間内包」のように、**名前だけでは何が起きるか分からない**
 * ものがある。名前を長くすると行が窮屈になり、常に説明を出すと設定の一覧が読めなくなる。
 * 知りたい人だけが触れば出る、という置き方にする。
 *
 * ## ホバーだけにしない
 *
 * キーボードで辿る人には hover が無い。focus でも同じように出す。
 * 「？」自体はボタンにして Tab で届くようにし、押しても（focus が残るので）出たままになる。
 *
 * ## 出る向きと、切れないこと
 *
 * **「？」の右**に出す。「？」は名前のすぐ後ろ（行の左寄り）にあるので、右には行の残りがある。
 * 以前は左へ開いていて、設定パネルの左の縁から先が切れていた。
 *
 * 説明は **body 直下に出す**（portal）。設定パネルはスクロールする面なので、その中に
 * 置く限り、どちらへ開いても面の縁で切れる。位置は「？」の実寸から測る
 * （help-hint-placement）。右に幅が足りないときだけ、下に出す。
 */
export function HelpHint({ subject, text }: HelpHintProps) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<HintPlacement | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const id = useId();

  useLayoutEffect(() => {
    if (!open) {
      setPlacement(null);
      return;
    }
    function update() {
      const button = buttonRef.current;
      const tip = tipRef.current;
      if (!button || !tip) return;
      // 収めたい面は、この「？」が載っている面（設定パネル）。無ければ窓全体。
      const surface = button.closest('[role="dialog"]');
      setPlacement(
        placeHint({
          anchor: button.getBoundingClientRect(),
          bounds: surface ? surface.getBoundingClientRect() : null,
          viewport: { width: window.innerWidth, height: window.innerHeight },
          // 説明は折り返すので、高さは幅が決まってから測る。
          measureHeight: (width) => {
            tip.style.width = `${width}px`;
            return tip.offsetHeight;
          },
        }),
      );
    }
    update();
    // 面がスクロールしても「？」から離れない。**閉じずに付いていく**——キーボードで辿ると、
    // focus した瞬間にブラウザが面をスクロールさせるので、閉じると開いたそばから消える。
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open]);

  return (
    <span className="inline-flex shrink-0 items-center">
      <button
        ref={buttonRef}
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
        {...verifyAttrs({ unit: 'HelpHint', open, subject, side: placement?.side ?? 'none' })}
      >
        ?
      </button>
      {open &&
        createPortal(
          <span
            ref={tipRef}
            id={id}
            role="tooltip"
            className="pointer-events-none fixed rounded-md px-2.5 py-2 text-[11px] leading-[1.7] shadow-md"
            style={{
              zIndex: LAYER.tooltip,
              left: placement?.left ?? 0,
              top: placement?.top ?? 0,
              width: placement?.width,
              // 測り終えるまでは見せない（窓の左上に一瞬出るのを避ける）。
              visibility: placement ? 'visible' : 'hidden',
              background: 'var(--fg)',
              color: 'var(--bg)',
              fontFamily: 'Inter, "Noto Sans JP", sans-serif',
            }}
          >
            {text}
          </span>,
          document.body,
        )}
    </span>
  );
}
