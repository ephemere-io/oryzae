'use client';

import { useState } from 'react';
import { useAutosaveEntry } from '@/features/shared/entries/hooks/use-autosave-entry';
import { useSaveEntry } from '@/features/shared/entries/hooks/use-entry';
import type { ApiClient } from '@/lib/api';

interface SpEntryEditorProps {
  api: ApiClient | null;
}

/**
 * SP 版「書く」エディタ v0（Issue #363 スパイク）。
 * 縦長1カラム・全画面フォーカス・自動保存。データの振る舞いは features/shared/entries の
 * hook をそのまま共有する（PC と同じ保存・取得ロジック）。
 *
 * TODO(#363): 音声入力 / フォーカスモード / 問い紐づけ / i18n(literal を next-intl へ)。
 */
export function SpEntryEditor({ api }: SpEntryEditorProps) {
  const { save, saving } = useSaveEntry(api, null);
  const [body, setBody] = useState('');
  const [entryId, setEntryId] = useState<string | undefined>(undefined);

  useAutosaveEntry({
    title: '',
    body,
    entryId,
    save,
    onSaved: (id) => setEntryId(id),
    enabled: api != null,
  });

  const statusLabel = saving ? '保存中…' : entryId ? '保存済み' : '';

  return (
    <div className="flex h-full flex-col bg-[var(--bg)] text-[var(--fg)]">
      <header className="flex items-center justify-between px-5 py-4 text-xs tracking-wide opacity-60">
        <span>今日の一言</span>
        <span aria-live="polite">{statusLabel}</span>
      </header>
      <textarea
        // biome-ignore lint/a11y/noAutofocus: 縦長フォーカスエディタは開いた瞬間に書き始められることが要件
        autoFocus
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="いま感じていることを、そのまま。"
        className="w-full flex-1 resize-none bg-transparent px-5 pb-16 text-lg leading-relaxed outline-none placeholder:opacity-40"
      />
    </div>
  );
}
