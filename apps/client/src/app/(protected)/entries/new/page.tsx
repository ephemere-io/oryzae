import { EntryEditor } from '@/components/entries/entry-editor';

export default function NewEntryPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">新しいエントリ</h1>
      <EntryEditor />
    </div>
  );
}
