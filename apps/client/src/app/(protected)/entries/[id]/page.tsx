'use client';

import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { EntryEditor } from '@/features/entries/components/entry-editor';
import { useDeleteEntry, useEntry } from '@/features/entries/hooks/use-entry';

export default function EntryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { api, auth, loading: authLoading } = useAuth();
  const { entry, loading } = useEntry(id, api, authLoading);
  const { remove, deleting } = useDeleteEntry(api);
  const router = useRouter();

  async function handleDelete() {
    if (!confirm('このエントリを削除しますか？')) return;
    const ok = await remove(id);
    if (ok) {
      router.push('/entries');
      router.refresh();
    }
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
      <EntryEditor entryId={entry.id} initialContent={entry.content} api={api} auth={auth} />
    </div>
  );
}
