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
        className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900"
      />
      <button
        type="submit"
        disabled={creating || !text.trim()}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {creating ? '追加中...' : '追加'}
      </button>
    </form>
  );
}
