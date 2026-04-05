'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';

interface EntryEditorProps {
  entryId?: string;
  initialContent?: string;
}

export function EntryEditor({ entryId, initialContent = '' }: EntryEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { api, session } = useAuth();
  const router = useRouter();

  async function handleSave() {
    if (!api || !session || !content.trim()) return;
    setSaving(true);
    setError('');

    const body = {
      content,
      mediaUrls: [] as string[],
      editorType: 'plaintext',
      editorVersion: '1.0.0',
      extension: {},
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    };

    if (entryId) {
      const url = api.api.v1.entries[':id'].$url({ param: { id: entryId } });
      const res = await fetch(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError('保存に失敗しました');
        setSaving(false);
        return;
      }
    } else {
      const url = api.api.v1.entries.$url();
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError('作成に失敗しました');
        setSaving(false);
        return;
      }
    }

    router.push('/entries');
    router.refresh();
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
