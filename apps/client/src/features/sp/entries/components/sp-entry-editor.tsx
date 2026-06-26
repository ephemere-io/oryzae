'use client';

import { useState } from 'react';
import { useAutosaveEntry } from '@/features/shared/entries/hooks/use-autosave-entry';
import { useSaveEntry } from '@/features/shared/entries/hooks/use-entry';
import type { ApiClient } from '@/lib/api';

interface SpEntryEditorProps {
  api: ApiClient | null;
}

type SpEntryStatus = '' | '編集中' | '保存中…' | '保存済み';

/**
 * SP 版「書く」エディタ（Issue #363）。軽量・キャプチャ特化。
 * 縦長1カラム・全画面フォーカス・任意タイトル＋本文・自動保存。データの振る舞いは
 * features/shared/entries の hook を PC と共有する。
 *
 * 仕様（インタビューで確定）: 演出/音声入力/スニペット/設定/文字数/発酵オーバーレイ/
 * 離脱ガードは持たない。下部に小さなステータスを表示する。
 * TODO(#363): 下部バーに「瓶に漬ける」(3b) と 問い紐づけシート(3c) を追加。
 */
export function SpEntryEditor({ api }: SpEntryEditorProps) {
  const { save, saving } = useSaveEntry(api, null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [entryId, setEntryId] = useState<string | undefined>(undefined);
  const [lastSavedBody, setLastSavedBody] = useState('');

  useAutosaveEntry({
    title,
    body,
    entryId,
    save,
    onSaved: (id, savedBody) => {
      setEntryId(id);
      setLastSavedBody(savedBody);
    },
    enabled: api != null,
  });

  const dirty = body !== lastSavedBody;
  const status: SpEntryStatus = saving
    ? '保存中…'
    : !body.trim()
      ? ''
      : dirty
        ? '編集中'
        : '保存済み';

  return (
    <div className="flex h-full flex-col bg-[var(--bg)] text-[var(--fg)]">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="タイトル（任意）"
        className="w-full bg-transparent px-5 pt-5 pb-2 text-base font-medium outline-none placeholder:opacity-30"
      />
      <textarea
        // biome-ignore lint/a11y/noAutofocus: 縦長フォーカスエディタは開いた瞬間に書き始められることが要件
        autoFocus
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="いま感じていることを、そのまま。"
        className="w-full flex-1 resize-none bg-transparent px-5 pb-4 text-lg leading-relaxed outline-none placeholder:opacity-40"
      />
      <footer className="flex items-center justify-between border-t border-[color-mix(in_srgb,var(--fg)_12%,transparent)] px-5 py-3 text-xs opacity-60">
        <span aria-live="polite">{status}</span>
        {/* 右側は 3b(瓶に漬ける) / 3c(問い) で埋める */}
        <span />
      </footer>
    </div>
  );
}
