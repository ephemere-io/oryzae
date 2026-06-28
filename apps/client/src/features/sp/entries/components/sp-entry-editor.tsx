'use client';

import { verifyAttrs } from '@oryzae/verify';
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
  /** 既存エントリを編集するとき。新規作成時は undefined。 */
  initialEntryId?: string;
  /** 既存エントリの本文（先頭行=タイトル）。新規は空。 */
  initialContent?: string;
}

/** content の先頭行をタイトル、残りを本文に分ける（エディタの保存形式）。 */
function splitTitleBody(raw: string): { title: string; body: string } {
  const idx = raw.indexOf('\n');
  if (idx === -1) return { title: '', body: raw };
  return { title: raw.slice(0, idx), body: raw.slice(idx + 1) };
}

/**
 * SP 版「書く」エディタ（Issue #363）。軽量・キャプチャ特化。
 * 縦長1カラム・全画面フォーカス・任意タイトル＋本文・自動保存。データの振る舞いは
 * features/shared の hook を PC と共有する。
 *
 * 仕様（インタビューで確定）: 演出/音声入力/スニペット/設定/文字数/発酵オーバーレイ/
 * 離脱ガードは持たない。下部バーに 小さなステータス・問い紐づけ・保存後の「瓶に漬ける」。
 * 瓶に漬けた後の自動遷移は持たない（インタビューで不要と確定）。
 */
export function SpEntryEditor({
  api,
  initialQuestionId = null,
  initialEntryId,
  initialContent = '',
}: SpEntryEditorProps) {
  const t = useTranslations('sp.editor');
  const { save, saving, error } = useSaveEntry(api, null);
  const activeQuestions = useActiveQuestions(api, false);
  // 既存エントリ編集なら content を タイトル/本文 に割って初期化（autosave は entryId 有りで更新）。
  const parsed = initialEntryId
    ? splitTitleBody(initialContent)
    : { title: '', body: initialContent };
  const [title, setTitle] = useState(parsed.title);
  const [body, setBody] = useState(parsed.body);
  const [entryId, setEntryId] = useState<string | undefined>(initialEntryId);
  const [lastSavedBody, setLastSavedBody] = useState(parsed.body);
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
  const hasBody = !!body.trim();
  const statusText = saving
    ? t('status_saving')
    : !hasBody
      ? ''
      : dirty
        ? t('status_editing')
        : t('status_saved');

  const selectedQuestion = activeQuestions.find((q) => q.id === selectedQuestionId);

  async function handlePickle() {
    if (!entryId || pickling || pickled) return;
    setPickling(true);
    const content = title.trim() ? `${title.trim()}\n${body}` : body;
    const saved = await save(content, entryId, { fermentationEnabled: true });
    setPickling(false);
    if (saved) setPickled(true);
  }

  return (
    <div
      className="relative flex h-full flex-col bg-[var(--bg)] text-[var(--fg)]"
      style={{ fontFamily: 'var(--ob-font-serif)' }}
      {...verifyAttrs({
        unit: 'SpEntryEditor',
        hasBody,
        dirty,
        hasEntry: !!entryId,
        sheetOpen,
        pickling,
      })}
    >
      {/* 保存ステータス（上部・常設）。指摘: 自動保存できたか分かるように。 */}
      <header className="flex items-center justify-end px-5 pt-3 pb-1" style={{ minHeight: 28 }}>
        <span
          aria-live="polite"
          className="flex items-center gap-1.5 text-xs"
          style={{
            color: error ? 'var(--ob-jar-warm)' : 'var(--accent)',
            opacity: statusText || error ? 1 : 0,
          }}
        >
          {saving ? (
            <span
              className="inline-block h-3 w-3 animate-spin rounded-full border border-current border-t-transparent"
              aria-hidden="true"
            />
          ) : statusText && !error ? (
            <span aria-hidden="true">✓</span>
          ) : null}
          {error || statusText || ' '}
        </span>
      </header>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t('title_placeholder')}
        aria-label={t('title_placeholder')}
        className="w-full bg-transparent px-5 pt-2 text-2xl font-medium leading-snug outline-none placeholder:opacity-25"
      />

      {/* 問いを結ぶチップ */}
      <div className="px-5 pt-4">
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="max-w-full truncate rounded-full px-3 py-1.5 text-xs"
          style={
            selectedQuestion
              ? {
                  background: 'var(--accent-light)',
                  color: 'var(--accent)',
                  border: '1px solid color-mix(in srgb, var(--accent) 22%, transparent)',
                }
              : { color: 'var(--date-color)', border: '1px dashed var(--border-subtle)' }
          }
        >
          {selectedQuestion
            ? `◦ ${selectedQuestion.currentText ?? t('question_untitled')}`
            : `+ ${t('question_link')}`}
        </button>
      </div>

      {/* 本文（タイトルから広い余白＋ゆったり行間）。指摘: 余白が欲しい。 */}
      <textarea
        // biome-ignore lint/a11y/noAutofocus: 縦長フォーカスエディタは開いた瞬間に書き始められることが要件
        autoFocus
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={t('body_placeholder')}
        aria-label={t('body_placeholder')}
        className="mt-6 w-full flex-1 resize-none bg-transparent px-5 pb-4 text-base outline-none placeholder:opacity-30"
        style={{ lineHeight: 2 }}
      />

      {/* 発酵させる CTA（保存済み＝entryId 確定後のみ）。指摘: pickle の意味が不明瞭。 */}
      {entryId ? (
        <div
          className="mx-4 mb-4 rounded-2xl p-4"
          style={{
            background: 'linear-gradient(135deg, var(--ob-jar-warm-soft), var(--accent-light))',
            border: '1px solid color-mix(in srgb, var(--ob-jar-warm) 20%, transparent)',
          }}
        >
          <div className="flex items-center gap-3">
            <svg
              className="h-8 w-8 shrink-0"
              style={{ color: 'var(--ob-jar-warm)' }}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path d="M9 3h6M8 7h8l-.6 11a2 2 0 0 1-2 1.9H10.6a2 2 0 0 1-2-1.9L8 7Z" />
              <path d="M8.4 12c1.5-.8 2.6-.8 3.6 0s2.1.8 3.6 0" strokeOpacity=".55" />
            </svg>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">
                {pickled ? t('pickled') : t('ferment_title')}
              </div>
              <div className="mt-0.5 text-xs leading-snug opacity-60">{t('ferment_sub')}</div>
            </div>
            <button
              type="button"
              onClick={handlePickle}
              disabled={pickling || pickled}
              className="shrink-0 rounded-xl px-3.5 py-2 text-xs font-bold text-white disabled:opacity-50"
              style={{
                background: 'var(--ob-jar-warm)',
                fontFamily: 'var(--ob-font-sans)',
              }}
            >
              {pickling ? t('pickling') : pickled ? '✓' : t('ferment_action')}
            </button>
          </div>
        </div>
      ) : null}

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
