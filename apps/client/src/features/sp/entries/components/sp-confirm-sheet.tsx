'use client';

import { verifyAttrs } from '@oryzae/verify';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';

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
 * SP 汎用「確認モーダル」（Issue #363）。削除など取り返しのつかない操作の確認に使う。
 *
 * 見た目と置き場所は `components/ui/confirm-dialog.tsx` が持つ（書斎の一覧など、端末を見ない
 * 場所からも同じ問いかけを出すため）。ここはエントリーの画面の検証の単位を公表するだけの包み。
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
    <ConfirmDialog
      open={open}
      title={title}
      message={message}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      destructive={destructive}
      busy={busy}
      onConfirm={onConfirm}
      onCancel={onCancel}
      contract={verifyAttrs({ unit: 'SpConfirmSheet', open, busy, destructive })}
    />
  );
}
