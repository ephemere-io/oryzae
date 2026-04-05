'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { EntryEditor } from '@/components/entries/entry-editor';
import { useAuth } from '@/hooks/use-auth';

interface EntryDetail {
  entry: {
    id: string;
    content: string;
    createdAt: string;
    updatedAt: string;
  };
}

export default function EntryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { api, loading: authLoading } = useAuth();
  const [entry, setEntry] = useState<EntryDetail['entry'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (authLoading || !api) return;

    api.api.v1.entries[':id'].$get({ param: { id } }).then(async (res) => {
      if (res.ok) {
        const data = await res.json();
        const e = 'entry' in data ? (data as EntryDetail).entry : data;
        setEntry(e as EntryDetail['entry']);
      }
      setLoading(false);
    });
  }, [api, authLoading, id]);

  async function handleDelete() {
    if (!api || !confirm('このエントリを削除しますか？')) return;
    setDeleting(true);
    await api.api.v1.entries[':id'].$delete({ param: { id } });
    router.push('/entries');
    router.refresh();
  }

  if (loading || authLoading) {
    return <p className="text-sm text-zinc-500">読み込み中...</p>;
  }

  if (!entry) {
    return <p className="text-sm text-zinc-500">エントリが見つかりません</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">エントリ編集</h1>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
        >
          {deleting ? '削除中...' : '削除'}
        </button>
      </div>
      <EntryEditor entryId={entry.id} initialContent={entry.content} />
    </div>
  );
}
