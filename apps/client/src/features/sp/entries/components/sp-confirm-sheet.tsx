'use client';

import { verifyAttrs } from '@oryzae/verify';

interface SpConfirmSheetProps {
  /** シートの開閉。false のときは何も描画しない（ルートだけ残す）。 */
  open: boolean;
  title: string;
  /** 補足説明（任意）。 */
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
  /** 破壊的操作（削除等）なら確定ボタンを警告色にする。 */
  destructive?: boolean;
  /** 実行中はボタンを無効化して多重実行を防ぐ。 */
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * SP 汎用「確認ボトムシート」（Issue #363）。削除など取り返しのつかない操作の確認に使う。
 * 下からスライドする bottom-sheet（sp-questions / sp-entry-editor の既存シートと同じ作法）。
 * 全画面オーバーレイは `fixed inset-0` で、マウント位置に依存せず確実に画面全体を覆う。
 * データは持たない純表示。確定/取消は呼び出し側に委ねる（list / editor が共有）。
 */
export function SpConfirmSheet({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: SpConfirmSheetProps) {
  return (
    <div {...verifyAttrs({ unit: 'SpConfirmSheet', open, busy, destructive })}>
      {open ? (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          {/* 背景タップで取消 */}
          <button
            type="button"
            aria-label={cancelLabel}
            onClick={onCancel}
            className="sp-fade flex-1 bg-black/30"
          />
          <div
            className="sp-sheet rounded-t-2xl bg-[var(--bg)] px-5 pt-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(0,0,0,0.15)]"
            style={{ fontFamily: 'var(--ob-font-sans)' }}
          >
            <p
              className="text-base font-medium text-[var(--fg)]"
              style={{ fontFamily: 'var(--ob-font-serif)' }}
            >
              {title}
            </p>
            {message ? (
              <p className="mt-2 text-sm leading-relaxed text-[var(--date-color)]">{message}</p>
            ) : null}
            <div className="mt-5 flex items-center gap-2">
              <button
                type="button"
                onClick={onCancel}
                disabled={busy}
                className="flex-1 rounded-xl py-3 text-sm text-[var(--fg)] disabled:opacity-50"
                style={{ border: '1px solid var(--border-subtle)' }}
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={busy}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium text-white disabled:opacity-60"
                style={{ background: destructive ? 'var(--ob-jar-warm)' : 'var(--accent)' }}
              >
                {busy ? (
                  <span
                    className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
                    aria-hidden="true"
                  />
                ) : null}
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
