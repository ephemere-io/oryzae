'use client';

import { useState } from 'react';

interface QuestionCreateFormProps {
  onSubmit: (text: string) => Promise<void>;
}

export function QuestionCreateForm({ onSubmit }: QuestionCreateFormProps) {
  const [text, setText] = useState('');
  const [creating, setCreating] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setCreating(true);
    await onSubmit(text);
    setText('');
    setCreating(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="新しい問いを追加..."
        maxLength={64}
        className="flex-1 rounded-full border border-[var(--border-subtle)] bg-transparent px-4 py-2 text-sm text-[var(--fg)] placeholder:text-[var(--date-color)] focus:border-[var(--accent)] focus:outline-none"
      />
      <button
        type="submit"
        disabled={creating || !text.trim()}
        className="rounded-full border border-[var(--accent)] px-5 py-2 text-sm font-medium text-[var(--accent)] transition-colors hover:bg-[var(--accent)] hover:text-white disabled:opacity-50"
      >
        {creating ? '追加中...' : '追加'}
      </button>
    </form>
  );
}
