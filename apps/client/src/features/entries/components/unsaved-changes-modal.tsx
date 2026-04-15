'use client';

interface UnsavedChangesModalProps {
  open: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onClose: () => void;
}

export function UnsavedChangesModal({
  open,
  onSave,
  onDiscard,
  onClose,
}: UnsavedChangesModalProps) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-label="Unsaved changes dialog"
      className="fixed inset-0 z-[2000] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        className="w-[90%] max-w-[400px] rounded-xl shadow-lg"
        style={{ backgroundColor: 'var(--bg)', padding: '28px 32px' }}
      >
        <h3 className="mb-2 text-sm font-semibold" style={{ color: 'var(--fg)' }}>
          未保存の変更があります
        </h3>
        <p className="mb-6 text-xs" style={{ color: 'var(--date-color)' }}>
          保存せずに移動すると変更内容が失われます。
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onDiscard}
            className="rounded-md border px-4 py-2 text-xs"
            style={{
              borderColor: 'var(--border-subtle)',
              color: 'var(--fg)',
              backgroundColor: 'var(--bg)',
            }}
          >
            保存しない
          </button>
          <button
            type="button"
            onClick={onSave}
            className="rounded-md border px-4 py-2 text-xs text-white"
            style={{ backgroundColor: 'var(--accent)', borderColor: 'var(--accent)' }}
          >
            保存する
          </button>
        </div>
      </div>
    </div>
  );
}
