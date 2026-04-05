'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useSaveEntry } from '@/features/entries/hooks/use-entry';
import type { ApiClient } from '@/lib/api';

interface AuthState {
  accessToken: string;
}

interface EntryEditorProps {
  entryId?: string;
  initialContent?: string;
  api: ApiClient | null;
  auth: AuthState | null;
}

export function EntryEditor({ entryId, initialContent = '', api, auth }: EntryEditorProps) {
  const [content, setContent] = useState(initialContent);
  const { save, saving, error } = useSaveEntry(api, auth);
  const router = useRouter();

  async function handleSave() {
    const ok = await save(content, entryId);
    if (ok) {
      router.push('/entries');
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>}

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="今日のことを書いてみましょう..."
        rows={12}
        className="w-full resize-y rounded-lg border border-zinc-300 p-4 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900"
      />

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.back()}
          className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          キャンセル
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !content.trim()}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {saving ? '保存中...' : entryId ? '更新' : '作成'}
        </button>
      </div>
    </div>
  );
}
