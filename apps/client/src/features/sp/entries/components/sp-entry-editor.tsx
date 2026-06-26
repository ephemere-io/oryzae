'use client';

import { useEffect, useRef, useState } from 'react';
import { useAutosaveEntry } from '@/features/shared/entries/hooks/use-autosave-entry';
import { useSaveEntry } from '@/features/shared/entries/hooks/use-entry';
import {
  useActiveQuestions,
  useEntryQuestions,
} from '@/features/shared/entry-questions/hooks/use-entry-questions';
import type { ApiClient } from '@/lib/api';

interface SpEntryEditorProps {
  api: ApiClient | null;
}

type SpEntryStatus = '' | '編集中' | '保存中…' | '保存済み';

/**
 * SP 版「書く」エディタ（Issue #363）。軽量・キャプチャ特化。
 * 縦長1カラム・全画面フォーカス・任意タイトル＋本文・自動保存。データの振る舞いは
 * features/shared の hook を PC と共有する。
 *
 * 仕様（インタビューで確定）: 演出/音声入力/スニペット/設定/文字数/発酵オーバーレイ/
 * 離脱ガードは持たない。下部バーに 小さなステータス・問い紐づけ・保存後の「瓶に漬ける」。
 * TODO(#363): i18n（リテラル→next-intl）、瓶に漬けた後の sp/jar への遷移。
 */
export function SpEntryEditor({ api }: SpEntryEditorProps) {
  const { save, saving } = useSaveEntry(api, null);
  const activeQuestions = useActiveQuestions(api, false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [entryId, setEntryId] = useState<string | undefined>(undefined);
  const [lastSavedBody, setLastSavedBody] = useState('');
  const [pickling, setPickling] = useState(false);
  const [pickled, setPickled] = useState(false);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const { linkQuestion } = useEntryQuestions(api, entryId);

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

  // 問いはエントリ作成後（entryId 確定後）に一度だけ紐づける。
  // 保存前に選んでいた場合も、autosave でエントリが出来た時点で紐づく。
  const linkAttemptedRef = useRef<string | null>(null);
  useEffect(() => {
    if (entryId && selectedQuestionId && linkAttemptedRef.current !== selectedQuestionId) {
      linkAttemptedRef.current = selectedQuestionId;
      linkQuestion(selectedQuestionId);
    }
  }, [entryId, selectedQuestionId, linkQuestion]);

  const dirty = body !== lastSavedBody;
  const status: SpEntryStatus = saving
    ? '保存中…'
    : !body.trim()
      ? ''
      : dirty
        ? '編集中'
        : '保存済み';

  const selectedQuestion = activeQuestions.find((q) => q.id === selectedQuestionId);
  const questionLabel = selectedQuestion ? (selectedQuestion.currentText ?? '無題の問い') : '問い';

  async function handlePickle() {
    if (!entryId || pickling || pickled) return;
    setPickling(true);
    const content = title.trim() ? `${title.trim()}\n${body}` : body;
    const saved = await save(content, entryId, { fermentationEnabled: true });
    setPickling(false);
    if (saved) setPickled(true);
  }

  return (
    <div className="relative flex h-full flex-col bg-[var(--bg)] text-[var(--fg)]">
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

      <footer className="flex items-center justify-between gap-3 border-t border-[color-mix(in_srgb,var(--fg)_12%,transparent)] px-5 py-3 text-xs">
        <span aria-live="polite" className="opacity-60">
          {status}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="max-w-[42vw] truncate rounded-full border border-[color-mix(in_srgb,var(--fg)_24%,transparent)] px-3 py-1"
          >
            {selectedQuestion ? `問い: ${questionLabel}` : '問い ▾'}
          </button>
          {entryId ? (
            <button
              type="button"
              onClick={handlePickle}
              disabled={pickling || pickled}
              className="shrink-0 rounded-full border border-[color-mix(in_srgb,var(--fg)_24%,transparent)] px-3 py-1 disabled:opacity-50"
            >
              {pickled ? '瓶に漬けました ✓' : pickling ? '漬けています…' : '瓶に漬ける'}
            </button>
          ) : null}
        </div>
      </footer>

      {sheetOpen ? (
        <div className="absolute inset-0 z-10 flex flex-col justify-end">
          <button
            type="button"
            aria-label="閉じる"
            onClick={() => setSheetOpen(false)}
            className="flex-1 bg-black/30"
          />
          <div className="max-h-[60%] overflow-auto rounded-t-2xl bg-[var(--bg)] pb-6 shadow-[0_-8px_24px_rgba(0,0,0,0.15)]">
            <div className="px-5 py-4 text-sm font-medium opacity-70">問いを選ぶ</div>
            {activeQuestions.length === 0 ? (
              <div className="px-5 py-4 text-sm opacity-50">
                立てている問いがありません（問いは PC で立てられます）
              </div>
            ) : (
              <ul>
                {activeQuestions.map((q) => {
                  const selected = q.id === selectedQuestionId;
                  return (
                    <li key={q.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedQuestionId(selected ? null : q.id);
                          setSheetOpen(false);
                        }}
                        className="flex w-full items-center justify-between px-5 py-3 text-left text-base hover:bg-[color-mix(in_srgb,var(--fg)_6%,transparent)]"
                      >
                        <span className="truncate">{q.currentText ?? '無題の問い'}</span>
                        {selected ? <span className="ml-3 shrink-0">✓</span> : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
