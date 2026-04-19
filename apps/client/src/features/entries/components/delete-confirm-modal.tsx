'use client';

import { useEffect, useRef } from 'react';

interface DeleteConfirmModalProps {
  open: boolean;
  deleting?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteConfirmModal({
  open,
  deleting = false,
  onCancel,
  onConfirm,
}: DeleteConfirmModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="削除確認ダイアログ"
      className="fixed inset-0 z-[2000] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
      onClick={onCancel}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onCancel();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        className="w-[90%] max-w-[400px] rounded-xl shadow-lg"
        style={{ backgroundColor: 'var(--bg)', padding: '28px 32px' }}
      >
        <h3 className="mb-2 text-sm font-semibold" style={{ color: 'var(--fg)' }}>
          本当に削除しますか？
        </h3>
        <p className="mb-6 text-xs" style={{ color: 'var(--date-color)' }}>
          このエントリーは完全に削除され、元に戻すことはできません。
        </p>
        <div className="flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="rounded-md border px-4 py-2 text-xs disabled:opacity-50"
            style={{
              borderColor: 'var(--border-subtle)',
              color: 'var(--fg)',
              backgroundColor: 'var(--bg)',
            }}
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="rounded-md border px-4 py-2 text-xs text-white disabled:opacity-50"
            style={{ backgroundColor: '#c0392b', borderColor: '#c0392b' }}
          >
            {deleting ? '削除中...' : '削除する'}
          </button>
        </div>
      </div>
    </div>
  );
}
