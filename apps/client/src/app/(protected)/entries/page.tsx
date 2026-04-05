import Link from 'next/link';
import { EntryList } from '@/components/entries/entry-list';

export default function EntriesPage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">エントリ</h1>
        <Link
          href="/entries/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          新規作成
        </Link>
      </div>
      <EntryList />
    </div>
  );
}
