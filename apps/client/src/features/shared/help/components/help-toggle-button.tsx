'use client';

import { verifyAttrs } from '@oryzae/verify';
import {
  ELEVATED_CHIP_CLASS,
  ELEVATED_CHIP_STYLE,
  ICON_STROKE_WIDTH,
} from '@/components/ui/surface';

export interface HelpToggleButtonProps {
  /** 面が開いているか（押されている状態）。 */
  open: boolean;
  /** 居場所を教えている最中か（初めての人が面を閉じた直後）。 */
  cue: boolean;
  /** 読み上げの名前。居場所を教えるときは隣に文字でも出す。 */
  label: string;
  onClick: () => void;
}

/**
 * 画面の右上の「?」。ヘルプの面はここから開き、ここから閉じる（`docs/help-mode-guide.md`）。
 *
 * **面が開いている間も消えない。** 開いているときは押された状態になり、もう一度押すと
 * 閉じる。面の幅（`--help-width`）のぶん左へ寄るので、面の左肩に居続ける。
 *
 * 初めての人には面を開いた状態で始め、閉じた直後にここが数回脈打って、隣に名前を出す。
 * 言葉で「ここから開けます」と説明する代わりに、動きと位置で教える。
 *
 * 面はパレットと同じ地・縁（`ELEVATED_CHIP_*`）。「書斎へ戻る」のタブや問いの変遷と
 * 同じ層（55）に居る。
 */
export function HelpToggleButton({ open, cue, label, onClick }: HelpToggleButtonProps) {
  return (
    <div
      {...verifyAttrs({ unit: 'HelpToggleButton', open, cue })}
      className="pointer-events-none fixed top-6 z-[55] flex items-center gap-2"
      style={{ right: 'calc(24px + var(--help-width, 0px))' }}
    >
      {cue && (
        <span
          className="help-fade text-[12px] tracking-[0.04em] text-[var(--fg)]"
          style={{ fontFamily: 'Inter, "Noto Sans JP", sans-serif' }}
        >
          {label}
        </span>
      )}
      <span className="relative flex">
        {cue && (
          <span
            aria-hidden="true"
            className="help-cue-ring pointer-events-none absolute inset-0 rounded-full border"
            style={{ borderColor: 'var(--accent)' }}
          />
        )}
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          aria-pressed={open}
          className={`pointer-events-auto relative flex h-9 w-9 items-center justify-center rounded-full ${ELEVATED_CHIP_CLASS}`}
          style={{
            ...ELEVATED_CHIP_STYLE,
            borderRadius: 9999,
            // 開いている間は「押されている」— 地を沈め、線を濃くする。
            ...(open
              ? {
                  background: 'var(--nav-active-bg)',
                  borderColor: 'var(--nav-active-border)',
                  color: 'var(--nav-active-fg)',
                }
              : {}),
          }}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={ICON_STROKE_WIDTH}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-[18px] w-[18px]"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M9.4 9.4a2.6 2.6 0 0 1 4.6 1.6c0 1.7-2.4 2-2.4 3.4" />
            <circle cx="12" cy="17.2" r="0.6" fill="currentColor" stroke="none" />
          </svg>
        </button>
      </span>
    </div>
  );
}
