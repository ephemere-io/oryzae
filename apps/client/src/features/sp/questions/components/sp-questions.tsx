'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { CONTROL_FONT } from '@/components/ui/surface';
import type { QuestionItem } from '@/features/shared/questions/types';
import { SpQuestionsCardsSkeleton } from '@/features/sp/questions/components/sp-questions-skeleton';
import { useSpBackHandler } from '@/lib/sp-chrome-context';

interface SpQuestionsProps {
  questions: QuestionItem[];
  loading: boolean;
  createQuestion: (text: string) => Promise<void> | void;
  editQuestion: (id: string, text: string) => Promise<void> | void;
  archiveQuestion: (id: string) => Promise<void> | void;
  acceptQuestion: (id: string) => Promise<void> | void;
  rejectQuestion: (id: string) => Promise<void> | void;
  /** 未読の手紙が届いている問いの id（Issue #452）。page が UnreadState から渡す。 */
  unreadQuestionIds?: ReadonlySet<string>;
  /**
   * 重ねて開かれているときの閉じ方。SP はボトムナビを持たないので、瓶から重ねて
   * 開くことがある（そのときだけ閉じるボタンを出す）。単独ページでは渡さない。
   */
  onClose?: () => void;
}

/** 既定値を毎レンダー作らないための空集合。 */
const NO_UNREAD: ReadonlySet<string> = new Set();

type Sheet = { mode: 'add' } | { mode: 'edit'; id: string };

/**
 * SP 版「問い」管理（Issue #363）。一覧・追加・編集・終了（アーカイブ）と、
 * Oryzae からの提案の受け入れ／見送りを行う。データ取得・更新は page が
 * features/shared/questions/hooks/use-questions で行い、ここは props で受ける
 * （PC の QuestionTimeline と同じ presentational 構成。二重フェッチを避ける）。
 */
export function SpQuestions({
  questions,
  loading,
  createQuestion,
  editQuestion,
  archiveQuestion,
  acceptQuestion,
  rejectQuestion,
  unreadQuestionIds = NO_UNREAD,
  onClose,
}: SpQuestionsProps) {
  const t = useTranslations('sp.questions');
  // 瓶から重ねて開いている間は、上段の「戻る」も書斎ではなくこの画面を閉じる。
  useSpBackHandler(onClose ?? null);

  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const proposed = questions.filter(
    (q) => q.isProposedByOryzae && !q.isValidatedByUser && !q.isArchived,
  );
  const active = questions.filter(
    (q) => !q.isArchived && !(q.isProposedByOryzae && !q.isValidatedByUser),
  );

  function openAdd() {
    setDraft('');
    setSheet({ mode: 'add' });
  }
  function openEdit(id: string, text: string) {
    setDraft(text);
    setSheet({ mode: 'edit', id });
  }

  async function submit() {
    if (!draft.trim() || submitting || !sheet) return;
    setSubmitting(true);
    if (sheet.mode === 'add') await createQuestion(draft.trim());
    else await editQuestion(sheet.id, draft.trim());
    setSubmitting(false);
    setSheet(null);
  }

  async function remove() {
    if (sheet?.mode !== 'edit' || submitting) return;
    setSubmitting(true);
    await archiveQuestion(sheet.id);
    setSubmitting(false);
    setSheet(null);
  }

  return (
    <div
      {...verifyAttrs({
        unit: 'SpQuestions',
        loading,
        sheetMode: sheet ? sheet.mode : 'none',
        closable: onClose !== undefined,
        submitting,
        draftEmpty: !draft.trim(),
        proposedCount: proposed.length,
        activeCount: active.length,
        unreadCount: active.filter((q) => unreadQuestionIds.has(q.id)).length,
      })}
      className="relative flex h-full flex-col bg-[var(--bg)] text-[var(--fg)]"
    >
      <header className="flex items-center justify-between gap-3 px-5 pt-6 pb-1">
        <span className="text-lg font-medium">{t('title')}</span>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] shrink-0 rounded-full border px-4 text-[13px]"
            style={{ ...CONTROL_FONT, color: 'var(--fg)', borderColor: 'var(--border-subtle)' }}
          >
            {t('close')}
          </button>
        ) : null}
      </header>
      <p
        className="px-5 pb-2 text-xs leading-relaxed text-[var(--date-color)]"
        style={CONTROL_FONT}
      >
        {t('intro')}
      </p>

      {loading ? (
        <SpQuestionsCardsSkeleton />
      ) : (
        <div className="sp-rise flex-1 overflow-auto px-5 pb-4">
          {/* Oryzae からの提案 */}
          {proposed.length > 0 ? (
            <div className="mb-4">
              <p
                className="mb-2 text-[11px] uppercase tracking-[0.14em]"
                style={{ ...CONTROL_FONT, color: 'var(--accent)' }}
              >
                {t('proposed')}
              </p>
              {proposed.map((q) => (
                <div
                  key={q.id}
                  className="mb-2 rounded-2xl p-4"
                  style={{
                    background: 'var(--accent-light)',
                    border: '1px solid color-mix(in srgb, var(--accent) 18%, transparent)',
                  }}
                >
                  <p className="text-[15px] leading-relaxed">{q.currentText}</p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => acceptQuestion(q.id)}
                      className="min-h-[36px] shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                      style={{ ...CONTROL_FONT, background: 'var(--accent)' }}
                    >
                      {t('accept')}
                    </button>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => rejectQuestion(q.id)}
                      className="min-h-[36px] shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 text-xs disabled:opacity-50"
                      style={{
                        ...CONTROL_FONT,
                        color: 'var(--date-color)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      {t('reject')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {/* 自分の問い */}
          {active.map((q) => {
            // Issue #452: ボトムナビのバッジだけでは「どの問いに届いたか」が分からなかった。
            const hasUnreadLetter = unreadQuestionIds.has(q.id);
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => openEdit(q.id, q.currentText ?? '')}
                className="relative mb-3 block w-full rounded-2xl p-4 text-left"
                style={{
                  background: 'var(--surface-raised)',
                  border: '1px solid var(--surface-raised-border)',
                }}
              >
                <span className="block pr-6 text-[15px] leading-relaxed">
                  {q.currentText ?? t('untitled')}
                </span>
                {hasUnreadLetter ? (
                  <span
                    className="mt-2 flex items-center gap-1.5 text-[11px]"
                    style={{ color: 'var(--ob-jar-warm)' }}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: 'var(--ob-jar-warm)' }}
                      aria-hidden="true"
                    />
                    {t('letter_arrived')}
                  </span>
                ) : null}
                <svg
                  className="absolute right-4 top-4"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--date-color)"
                  strokeWidth="1.7"
                  aria-hidden="true"
                >
                  <title>edit</title>
                  <path d="M4 20h4L18 10l-4-4L4 16v4Z" strokeLinejoin="round" />
                </svg>
              </button>
            );
          })}

          {active.length === 0 && proposed.length === 0 ? (
            <p className="py-10 text-center text-sm opacity-50">{t('empty')}</p>
          ) : null}

          <button
            type="button"
            onClick={openAdd}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-medium"
            style={{
              ...CONTROL_FONT,
              border: '1.5px dashed var(--surface-raised-border)',
              color: 'var(--accent)',
            }}
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <title>add</title>
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            {t('add')}
          </button>
        </div>
      )}

      {/* 追加 / 編集 ボトムシート */}
      {sheet ? (
        <div className="absolute inset-0 z-10 flex flex-col justify-end">
          <button
            type="button"
            aria-label={t('cancel')}
            onClick={() => setSheet(null)}
            className="flex-1 bg-black/30"
          />
          <div className="sp-sheet rounded-t-2xl bg-[var(--bg)] px-5 pt-5 pb-6 shadow-[0_-8px_24px_rgba(0,0,0,0.15)]">
            <p
              className="mb-3 text-[11px] uppercase tracking-[0.14em]"
              style={{ ...CONTROL_FONT, color: 'var(--accent)' }}
            >
              {sheet.mode === 'add' ? t('sheet_add') : t('sheet_edit')}
            </p>
            <textarea
              // biome-ignore lint/a11y/noAutofocus: シートを開いた瞬間に書き始められることが要件
              autoFocus
              aria-label={t('placeholder')}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={64}
              rows={3}
              placeholder={t('placeholder')}
              className="w-full resize-none rounded-xl bg-transparent p-3 text-base outline-none"
              style={{ border: '1px solid var(--border-subtle)', lineHeight: 1.7 }}
            />
            {/* 保存とキャンセルは右寄せで 1 行（縮めない: 幅が足りないと「保／存」に割れた）。
                「終える」は破壊的な操作なので、同じ行に並べず下に離す。 */}
            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setSheet(null)}
                className="min-h-[40px] shrink-0 whitespace-nowrap rounded-full px-4 text-[13px] disabled:opacity-50"
                style={{ ...CONTROL_FONT, color: 'var(--date-color)' }}
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                disabled={submitting || !draft.trim()}
                onClick={submit}
                className="min-h-[40px] shrink-0 whitespace-nowrap rounded-full px-5 text-[13px] font-medium text-white disabled:opacity-50"
                style={{ ...CONTROL_FONT, background: 'var(--accent)' }}
              >
                {t('save')}
              </button>
            </div>
            {sheet.mode === 'edit' ? (
              <button
                type="button"
                disabled={submitting}
                onClick={remove}
                className="mt-4 min-h-[40px] w-full whitespace-nowrap rounded-full text-[13px] disabled:opacity-50"
                style={{
                  ...CONTROL_FONT,
                  color: 'var(--ob-jar-warm)',
                  border: '1px solid color-mix(in srgb, var(--ob-jar-warm) 30%, transparent)',
                }}
              >
                {t('delete')}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
