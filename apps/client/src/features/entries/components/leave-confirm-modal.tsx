'use client';

import { useEffect, useRef } from 'react';

interface LeaveConfirmModalProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function LeaveConfirmModal({ open, onCancel, onConfirm }: LeaveConfirmModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="離脱確認ダイアログ"
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
          本当に離れますか？
        </h3>
        <p className="mb-6 text-xs" style={{ color: 'var(--date-color)' }}>
          未保存の変更は失われます。
        </p>
        <div className="flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="rounded-md border px-4 py-2 text-xs"
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
            className="rounded-md border px-4 py-2 text-xs text-white"
            style={{ backgroundColor: 'var(--accent)', borderColor: 'var(--accent)' }}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
