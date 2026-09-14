'use client';

import { verifyAttrs } from '@oryzae/verify';
import type { ReactNode } from 'react';
import { KeyboardDownIcon } from './palette-icons';
import { CONTROL_FONT } from './surface';

export interface PaletteAction {
  /** 検証と読み上げの手掛かり（`data-palette-action`）。画面の中で一意に。 */
  id: string;
  /** 読み上げに出す正式な名前。 */
  label: string;
  /** 目に見える短い名前。無ければ `label`。 */
  caption?: string;
  icon: ReactNode;
  onSelect: () => void;
  /** 押せない理由。あれば押せない（理由は読み上げに添える）。 */
  disabledReason?: string;
  /** いま効いている状態。印を添える。 */
  active?: boolean;
  /** 送信中など、一時的に押せない。 */
  busy?: boolean;
  tone?: 'normal' | 'danger';
}

interface ActionPaletteProps {
  actions: PaletteAction[];
  ariaLabel: string;
  /**
   * キーボードが出ているか。出ていれば右端に「キーボードを閉じる」を置き、
   * 下端の安全領域の余白は取らない（キーボードの真上に付くので）。
   */
  keyboardOpen?: boolean;
  dismissKeyboardLabel?: string;
}

/** 列の高さ（px）。安全領域の余白は別に足す。 */
const ACTION_PALETTE_HEIGHT = 56;

/**
 * 画面の下端の操作の列。**エントリー・ボード・瓶で同じ部品**、中身だけが違う。
 *
 * 置き場は流れの中（SP の殻の下端）。殻がビジュアルビューポートに追従するので、
 * キーボードが出ればこの列はキーボードの真上に来る（Notion のモバイルのキーボード
 * ツールバーと同じ席）。`fixed` で置かないのは、iOS でキャレットを見せるスクロールが
 * 走るとレイアウトビューポート基準の `fixed` が本文の下へ潜るため（実機で報告）。
 *
 * アイコンに短い名前を添える。SP にはホバーが無く、名前を隠す手が無い。
 */
export function ActionPalette({
  actions,
  ariaLabel,
  keyboardOpen = false,
  dismissKeyboardLabel,
}: ActionPaletteProps) {
  return (
    <div
      {...verifyAttrs({ unit: 'ActionPalette', actionCount: actions.length, keyboardOpen })}
      role="toolbar"
      aria-label={ariaLabel}
      className="flex shrink-0 items-stretch gap-1 px-2"
      style={{
        ...CONTROL_FONT,
        height: ACTION_PALETTE_HEIGHT,
        boxSizing: 'content-box',
        // キーボードが無いときはホームインジケータの上に載る。
        paddingBottom: keyboardOpen ? 0 : 'env(safe-area-inset-bottom, 0px)',
        background: 'var(--surface-raised)',
        borderTop: '1px solid var(--surface-raised-border)',
      }}
    >
      {actions.map((action) => {
        const disabled = Boolean(action.disabledReason) || Boolean(action.busy);
        return (
          <button
            key={action.id}
            type="button"
            aria-label={
              action.disabledReason ? `${action.label}（${action.disabledReason}）` : action.label
            }
            aria-disabled={disabled}
            data-palette-action={action.id}
            onClick={() => {
              if (disabled) return;
              action.onSelect();
            }}
            // 押しても本文のフォーカスを落とさない（キーボードが一度引っ込んでまた出る、をやめる）。
            onPointerDown={(event) => event.preventDefault()}
            onMouseDown={(event) => event.preventDefault()}
            className={`relative flex min-w-[60px] flex-col items-center justify-center gap-1 whitespace-nowrap rounded-xl px-2 transition-colors active:scale-95 ${
              disabled ? 'opacity-40' : 'hover:bg-[var(--hover-wash)]'
            }`}
            style={{
              color:
                action.tone === 'danger'
                  ? 'var(--ob-jar-warm)'
                  : action.active
                    ? 'var(--accent)'
                    : 'var(--fg)',
            }}
          >
            {action.busy ? (
              <span
                className="inline-block h-[22px] w-[22px] animate-spin rounded-full border-2 border-current border-t-transparent"
                aria-hidden="true"
              />
            ) : (
              action.icon
            )}
            <span className="text-[10px] leading-none tracking-[0.04em]">
              {action.caption ?? action.label}
            </span>
            {action.active ? (
              <span
                aria-hidden="true"
                className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full"
                style={{ background: 'var(--accent)' }}
              />
            ) : null}
          </button>
        );
      })}

      <span className="flex-1" />

      {keyboardOpen && dismissKeyboardLabel ? (
        <button
          type="button"
          aria-label={dismissKeyboardLabel}
          data-palette-action="dismiss-keyboard"
          onClick={() => {
            if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
          }}
          className="flex w-14 items-center justify-center rounded-xl transition-colors hover:bg-[var(--hover-wash)] active:scale-95"
          style={{ color: 'var(--date-color)' }}
        >
          <KeyboardDownIcon />
        </button>
      ) : null}
    </div>
  );
}
