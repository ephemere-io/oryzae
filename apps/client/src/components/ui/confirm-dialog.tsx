'use client';

import type { ReactNode } from 'react';
import { placeInSlot, useSpChrome } from '@/lib/sp-chrome-context';

export interface ConfirmDialogProps {
  /** 出ているか。false のときは何も描かない。 */
  open: boolean;
  title: string;
  /** 補足（任意）。 */
  message?: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  /** 取り返しのつかない操作なら確定のボタンを警告色にする。 */
  destructive?: boolean;
  /** 実行中。両方のボタンを止めて、確定に回るしるしを出す。 */
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** 検証の契約（根に付ける）。 */
  contract?: Record<string, string>;
}

/**
 * 「本当に○○しますか？」の**モーダル**。下から出るが、**シートではない**。
 *
 * 段（detent）を持たず、指で高さを変えられない。**やることが 1 つに決まっている問いかけ**には
 * これを使う。`BottomSheet` のような段のあるシートは、読む／選ぶ量が指で変わるもの
 * （発酵の結果・問いの編集）のためのもので、はい／いいえの問いかけに使うと
 * 「動かせそうなのに動かす意味が無い」ちぐはぐさが出る（オーナー: 一覧の行の操作について
 * 「セミモーダルという位置付けがなんか違和感。普通にモーダルで」）。
 *
 * SP の殻の中なら殻の overlay の席（ビジュアルビューポートに追従）に出す。`fixed` はレイアウト
 * ビューポート基準なので、キーボードの出入りの途中に開くと画面の上の方に浮いた（実機レビュー）。
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
  contract,
}: ConfirmDialogProps) {
  const { overlaySlot } = useSpChrome();
  return (
    <div {...contract}>
      {open
        ? placeInSlot(
            <div
              className={`${overlaySlot ? 'pointer-events-auto absolute' : 'fixed'} inset-0 z-50 flex flex-col justify-end`}
            >
              {/* 背景を押したら取消。 */}
              <button
                type="button"
                aria-label={cancelLabel}
                onClick={onCancel}
                className="sp-fade flex-1 bg-black/30"
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-label={title}
                className="sp-sheet rounded-t-2xl bg-[var(--surface-raised)] px-5 pt-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(0,0,0,0.15)]"
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
            </div>,
            overlaySlot,
          )
        : null}
    </div>
  );
}
