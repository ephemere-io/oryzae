'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { JAR_ICON_PATH } from '@/components/ui/icon-paths';
import { useAutosaveEntry } from '@/features/shared/entries/hooks/use-autosave-entry';
import { useDeleteEntry } from '@/features/shared/entries/hooks/use-delete-entry';
import { useSaveEntry } from '@/features/shared/entries/hooks/use-entry';
import { useEntryDraft } from '@/features/shared/entries/hooks/use-entry-draft';
import type { EntryDraft } from '@/features/shared/entries/types';
import {
  useActiveQuestions,
  useEntryQuestions,
} from '@/features/shared/entry-questions/hooks/use-entry-questions';
import type { ApiClient } from '@/lib/api';
import { SpConfirmSheet } from './sp-confirm-sheet';

interface SpEntryEditorProps {
  api: ApiClient | null;
  /** 手紙への返事など、URL の questionId を初期紐づけする（内省ループの接続）。 */
  initialQuestionId?: string | null;
  /** 既存エントリを編集するとき。新規作成時は undefined。 */
  initialEntryId?: string;
  /** 既存エントリの本文（先頭行=タイトル）。新規は空。 */
  initialContent?: string;
  /**
   * 書きかけドラフトの退避/復元を有効にするか（既定 true）。
   * 孤立検証（verify）では localStorage が fixture をまたいで漏れるため false にする。
   */
  persistDraft?: boolean;
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
  persistDraft = true,
}: SpEntryEditorProps) {
  const t = useTranslations('sp.editor');
  const tDelete = useTranslations('entries.delete_modal');
  const router = useRouter();
  const { deleteEntry, deleting } = useDeleteEntry(api);
  const { save, saving, error } = useSaveEntry(api, null);
  const activeQuestions = useActiveQuestions(api, false);
  const { load: loadDraft, save: saveDraft, clear: clearDraft } = useEntryDraft();

  // ドラフト退避/復元は「素の新規フロー」だけで行う（既存編集・問い返信は対象外）。
  const draftEnabled = persistDraft && !initialEntryId && !initialQuestionId;
  // マウント時に一度だけ、新鮮なドラフトがあれば書きかけを復元する（+ 押し直しでの再開）。
  const [restored] = useState<EntryDraft | null>(() => (draftEnabled ? loadDraft() : null));

  // 既存エントリ編集なら content を タイトル/本文 に割って初期化（autosave は entryId 有りで更新）。
  const init = initialEntryId
    ? splitTitleBody(initialContent)
    : restored
      ? { title: restored.title, body: restored.body }
      : { title: '', body: initialContent };
  const resolvedEntryId = initialEntryId ?? restored?.entryId;
  const [title, setTitle] = useState(init.title);
  const [body, setBody] = useState(init.body);
  const [entryId, setEntryId] = useState<string | undefined>(resolvedEntryId);
  // サーバ保存済み（entryId あり）なら保存済み表示、未保存の復元ドラフトは「編集中」表示にする。
  const [lastSavedBody, setLastSavedBody] = useState(resolvedEntryId ? init.body : '');
  const [pickling, setPickling] = useState(false);
  const [pickled, setPickled] = useState(false);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(
    initialQuestionId ?? restored?.questionId ?? null,
  );
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // 書きかけ（タイトル/本文/問い/entryId）を localStorage に退避する。内容が空になればクリア。
  // 発酵（瓶に納める）後は確定とみなして退避しない。
  useEffect(() => {
    if (!draftEnabled || pickled) return;
    if (!title.trim() && !body.trim()) {
      clearDraft();
      return;
    }
    saveDraft({ entryId, title, body, questionId: selectedQuestionId });
  }, [draftEnabled, pickled, title, body, entryId, selectedQuestionId, saveDraft, clearDraft]);

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
    if (saved) {
      setPickled(true);
      clearDraft(); // 発酵させたら確定。書きかけドラフトは破棄する。
    }
  }

  // 確認シートで「削除する」→ API 削除が成功したら一覧へ戻る（フル遷移は不要・SPA で十分）。
  async function handleDelete() {
    if (!entryId) return;
    const ok = await deleteEntry(entryId);
    if (ok) {
      clearDraft();
      router.push('/entries');
    } else {
      setDeleteOpen(false);
    }
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
        deleteOpen,
      })}
    >
      {/* 保存ステータス（右・常設）＋ 既存エントリの削除トリガー（左・⋯）。 */}
      <header
        className="flex items-center justify-between px-5 pt-3 pb-1"
        style={{ minHeight: 28 }}
      >
        {/* 既存エントリだけ削除できる（新規は削除対象が無いので出さない）。 */}
        {entryId ? (
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            aria-label={t('delete')}
            className="-ml-2 p-2 text-[var(--date-color)]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <title>more</title>
              <circle cx="12" cy="5" r="1.6" />
              <circle cx="12" cy="12" r="1.6" />
              <circle cx="12" cy="19" r="1.6" />
            </svg>
          </button>
        ) : (
          <span aria-hidden="true" />
        )}
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

      {/* 発酵させる CTA（保存済み＝entryId 確定後のみ）。
          バナー全体を1つの大きなボタンにして、シンプルで押しやすく（指摘対応）。 */}
      {entryId ? (
        <div className="sp-rise mx-4 mb-4">
          <button
            type="button"
            onClick={handlePickle}
            disabled={pickling || pickled}
            aria-label={t('ferment_title')}
            className="flex w-full items-center justify-center gap-2.5 rounded-2xl px-5 py-4 text-white transition-opacity disabled:cursor-default"
            style={{
              background: pickled
                ? 'color-mix(in srgb, var(--ob-jar-warm) 45%, var(--bg))'
                : 'var(--ob-jar-warm)',
              boxShadow:
                pickling || pickled
                  ? 'none'
                  : '0 8px 20px -8px color-mix(in srgb, var(--ob-jar-warm) 60%, transparent)',
              fontFamily: 'var(--ob-font-sans)',
            }}
          >
            {pickling ? (
              <span
                className="inline-block h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-white border-t-transparent"
                aria-hidden="true"
              />
            ) : (
              <svg
                className="h-5 w-5 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                aria-hidden="true"
              >
                <path d={JAR_ICON_PATH} strokeLinejoin="round" />
                {/* 中身（発酵しているもの）の水位。胴の幅に合わせる。 */}
                <path d="M6.6 14.4c1.8.8 3.6.8 5.4 0s3.6-.8 5.4 0" strokeOpacity=".55" />
              </svg>
            )}
            <span className="text-[15px] font-bold">
              {pickling ? t('pickling') : pickled ? t('pickled') : t('ferment_title')}
            </span>
          </button>
          {!pickled ? (
            <p className="mt-2 text-center text-xs leading-snug opacity-55">{t('ferment_sub')}</p>
          ) : null}
        </div>
      ) : null}

      {sheetOpen ? (
        <div className="absolute inset-0 z-10 flex flex-col justify-end">
          <button
            type="button"
            aria-label={t('close')}
            onClick={() => setSheetOpen(false)}
            className="sp-fade flex-1 bg-black/30"
          />
          <div className="sp-sheet max-h-[60%] overflow-auto rounded-t-2xl bg-[var(--bg)] pb-6 shadow-[0_-8px_24px_rgba(0,0,0,0.15)]">
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

      <SpConfirmSheet
        open={deleteOpen}
        title={tDelete('heading')}
        message={tDelete('body')}
        confirmLabel={tDelete('confirm')}
        cancelLabel={tDelete('cancel')}
        destructive
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
}
