'use client';

import { useAuth } from '@/features/auth/hooks/use-auth';
import { EntryEditor } from '@/features/entries/components/entry-editor';

export default function NewEntryPage() {
  const { api, auth } = useAuth();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">新しいエントリ</h1>
      <EntryEditor api={api} auth={auth} />
    </div>
  );
}
