'use client';

import { useEffect, useRef, useState } from 'react';

interface SnippetDialogProps {
  open: boolean;
  initialText?: string;
  onSubmit: (text: string) => void;
  onClose: () => void;
}

export function SnippetDialog({ open, initialText = '', onSubmit, onClose }: SnippetDialogProps) {
  const [text, setText] = useState(initialText);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setText(initialText);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, initialText]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (trimmed.length > 0 && trimmed.length <= 50) {
      onSubmit(trimmed);
      onClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-label="Snippet dialog"
      className="fixed inset-0 z-[2000] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="w-80 rounded-lg p-6 shadow-lg"
        style={{ backgroundColor: 'var(--bg)', border: '1px solid var(--border-subtle)' }}
      >
        <h3
          className="mb-4 text-xs font-semibold uppercase tracking-wider"
          style={{ color: 'var(--accent)', fontFamily: 'Inter, sans-serif' }}
        >
          {initialText ? 'スニペットを編集' : 'スニペットを作成'}
        </h3>
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={50}
          rows={3}
          placeholder="テキストを入力..."
          className="mb-3 w-full resize-none rounded border px-3 py-2 text-sm outline-none"
          style={{
            backgroundColor: 'var(--bg)',
            borderColor: 'var(--accent)',
            color: 'var(--fg)',
          }}
        />
        <div className="flex items-center justify-between">
          <span className="text-[10px]" style={{ color: 'var(--date-color)' }}>
            {text.length}/50
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded px-3 py-1 text-xs"
              style={{ color: 'var(--date-color)' }}
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={text.trim().length === 0}
              className="rounded px-3 py-1 text-xs text-white disabled:opacity-40"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              {initialText ? '更新' : '作成'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
