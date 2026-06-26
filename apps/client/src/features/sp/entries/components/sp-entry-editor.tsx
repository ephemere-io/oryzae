'use client';

import { useTranslations } from 'next-intl';
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
  /** 手紙への返事など、URL の questionId を初期紐づけする（内省ループの接続）。 */
  initialQuestionId?: string | null;
}

/**
 * SP 版「書く」エディタ（Issue #363）。軽量・キャプチャ特化。
 * 縦長1カラム・全画面フォーカス・任意タイトル＋本文・自動保存。データの振る舞いは
 * features/shared の hook を PC と共有する。
 *
 * 仕様（インタビューで確定）: 演出/音声入力/スニペット/設定/文字数/発酵オーバーレイ/
 * 離脱ガードは持たない。下部バーに 小さなステータス・問い紐づけ・保存後の「瓶に漬ける」。
 * TODO(#363): 瓶に漬けた後の sp/jar（手紙画面）への遷移（当該スライス実装後）。
 */
export function SpEntryEditor({ api, initialQuestionId = null }: SpEntryEditorProps) {
  const t = useTranslations('sp.editor');
  const { save, saving } = useSaveEntry(api, null);
  const activeQuestions = useActiveQuestions(api, false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [entryId, setEntryId] = useState<string | undefined>(undefined);
  const [lastSavedBody, setLastSavedBody] = useState('');
  const [pickling, setPickling] = useState(false);
  const [pickled, setPickled] = useState(false);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(initialQuestionId);
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
  const statusText = saving
    ? t('status_saving')
    : !body.trim()
      ? ''
      : dirty
        ? t('status_editing')
        : t('status_saved');

  const selectedQuestion = activeQuestions.find((q) => q.id === selectedQuestionId);
  const pickleLabel = pickled ? t('pickled') : pickling ? t('pickling') : t('pickle');

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
        placeholder={t('title_placeholder')}
        className="w-full bg-transparent px-5 pt-5 pb-2 text-base font-medium outline-none placeholder:opacity-30"
      />
      <textarea
        // biome-ignore lint/a11y/noAutofocus: 縦長フォーカスエディタは開いた瞬間に書き始められることが要件
        autoFocus
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={t('body_placeholder')}
        className="w-full flex-1 resize-none bg-transparent px-5 pb-4 text-lg leading-relaxed outline-none placeholder:opacity-40"
      />

      <footer className="flex items-center justify-between gap-3 border-t border-[color-mix(in_srgb,var(--fg)_12%,transparent)] px-5 py-3 text-xs">
        <span aria-live="polite" className="opacity-60">
          {statusText}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="max-w-[42vw] truncate rounded-full border border-[color-mix(in_srgb,var(--fg)_24%,transparent)] px-3 py-1"
          >
            {selectedQuestion
              ? t('question_selected', {
                  label: selectedQuestion.currentText ?? t('question_untitled'),
                })
              : `${t('question')} ▾`}
          </button>
          {entryId ? (
            <button
              type="button"
              onClick={handlePickle}
              disabled={pickling || pickled}
              className="shrink-0 rounded-full border border-[color-mix(in_srgb,var(--fg)_24%,transparent)] px-3 py-1 disabled:opacity-50"
            >
              {pickleLabel}
            </button>
          ) : null}
        </div>
      </footer>

      {sheetOpen ? (
        <div className="absolute inset-0 z-10 flex flex-col justify-end">
          <button
            type="button"
            aria-label={t('close')}
            onClick={() => setSheetOpen(false)}
            className="flex-1 bg-black/30"
          />
          <div className="max-h-[60%] overflow-auto rounded-t-2xl bg-[var(--bg)] pb-6 shadow-[0_-8px_24px_rgba(0,0,0,0.15)]">
            <div className="px-5 py-4 text-sm font-medium opacity-70">
              {t('question_sheet_title')}
            </div>
            {activeQuestions.length === 0 ? (
              <div className="px-5 py-4 text-sm opacity-50">{t('question_empty')}</div>
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
                        <span className="truncate">{q.currentText ?? t('question_untitled')}</span>
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
