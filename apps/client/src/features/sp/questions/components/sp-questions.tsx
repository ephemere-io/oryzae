'use client';

import { MAX_ACTIVE_QUESTIONS } from '@oryzae/shared';
import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { CONTROL_FONT } from '@/components/ui/surface';
import type { QuestionItem } from '@/features/shared/questions/types';
import { SpQuestionsCardsSkeleton } from '@/features/sp/questions/components/sp-questions-skeleton';
import { useSpBackHandler, useSpChrome } from '@/lib/sp-chrome-context';

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
   * 開くことがある。上段（SpTopBar）の中では戻るがこれを担い、上段が無い場所では
   * 閉じるボタンを出す。単独ページでは渡さない。
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
 *
 * 追加・編集は高さを変えられるセミモーダル（`BottomSheet`）。キーボードが出るので
 * 高い段から開く。
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
  const { mounted } = useSpChrome();
  // 瓶から重ねて開いている間は、上段の「戻る」も書斎ではなくこの画面を閉じる。
  useSpBackHandler(onClose ?? null);

  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  /**
   * アーカイブの確かめ中か。1 回押しただけでアーカイブされ、押し間違えたら取り返しがつかない感じが
   * した（レビュー）。同じシートの中で「アーカイブしますか？」を挟む。
   */
  const [confirmingArchive, setConfirmingArchive] = useState(false);

  const proposed = questions.filter(
    (q) => q.isProposedByOryzae && !q.isValidatedByUser && !q.isArchived,
  );
  const active = questions.filter(
    (q) => !q.isArchived && !(q.isProposedByOryzae && !q.isValidatedByUser),
  );
  // 上限（#430）なら「立てる」を出さず、理由を言う。押せるのに何も起きない、をやめる（レビュー）。
  const atLimit = active.length >= MAX_ACTIVE_QUESTIONS;

  function openAdd() {
    setConfirmingArchive(false);
    setDraft('');
    setSheet({ mode: 'add' });
  }
  function openEdit(id: string, text: string) {
    setConfirmingArchive(false);
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
    setConfirmingArchive(false);
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
        atLimit,
        unreadCount: active.filter((q) => unreadQuestionIds.has(q.id)).length,
      })}
      className="relative flex h-full flex-col bg-[var(--bg)] text-[var(--fg)]"
    >
      <header className="flex items-center justify-between gap-3 px-5 pt-5 pb-1">
        <span className="text-lg font-medium">{t('title')}</span>
        {/* 上段が無い場所（孤立検証・テスト）だけ、自前の閉じるを出す。 */}
        {onClose && !mounted ? (
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
                    style={{ ...CONTROL_FONT, color: 'var(--ob-jar-warm)' }}
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

          {atLimit ? (
            <p
              data-question-limit
              className="mt-1 rounded-2xl px-4 py-3.5 text-center text-[13px] leading-relaxed"
              style={{
                ...CONTROL_FONT,
                color: 'var(--date-color)',
                background: 'var(--surface-sunken)',
              }}
            >
              {t('limit', { max: MAX_ACTIVE_QUESTIONS })}
            </p>
          ) : (
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
          )}
        </div>
      )}

      {/* 追加 / 編集。キーボードが出るので高い段から開く。 */}
      <BottomSheet
        open={sheet !== null}
        onClose={() => setSheet(null)}
        ariaLabel={sheet?.mode === 'edit' ? t('sheet_edit') : t('sheet_add')}
        label={sheet?.mode === 'edit' ? t('sheet_edit') : t('sheet_add')}
        closeLabel={t('cancel')}
        detents={['content', 'full']}
        initialDetent="content"
      >
        {sheet ? (
          <>
            <textarea
              // biome-ignore lint/a11y/noAutofocus: シートを開いた瞬間に書き始められることが要件
              autoFocus
              aria-label={t('placeholder')}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={64}
              rows={3}
              placeholder={t('placeholder')}
              className="w-full resize-none rounded-xl p-3 text-base outline-none"
              style={{
                background: 'var(--surface-raised)',
                border: '1px solid var(--surface-raised-border)',
                lineHeight: 1.7,
              }}
            />
            {/* 保存は右寄せの 1 つ（キャンセルはシートの見出しにある）。 */}
            <div className="mt-3 flex items-center justify-end gap-2">
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
            {/* アーカイブは保存の行から離して下に。押したら同じ場所で確かめる。 */}
            {sheet.mode === 'edit' && confirmingArchive ? (
              <div
                data-archive-confirm
                className="mt-6 flex flex-col gap-2 rounded-2xl p-4"
                style={{ ...CONTROL_FONT, background: 'var(--surface-sunken)' }}
              >
                <p className="m-0 text-[14px] font-medium" style={{ color: 'var(--fg)' }}>
                  {t('archive_confirm_title')}
                </p>
                <p
                  className="m-0 text-[12px] leading-relaxed"
                  style={{ color: 'var(--date-color)' }}
                >
                  {t('archive_confirm_body')}
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setConfirmingArchive(false)}
                    className="min-h-[44px] flex-1 rounded-full text-[13px] disabled:opacity-50"
                    style={{ color: 'var(--fg)', background: 'var(--surface-raised)' }}
                  >
                    {t('archive_cancel')}
                  </button>
                  <button
                    type="button"
                    data-archive-confirm-yes
                    disabled={submitting}
                    onClick={remove}
                    className="min-h-[44px] flex-1 rounded-full text-[13px] font-medium text-white disabled:opacity-50"
                    style={{ background: 'var(--ob-jar-warm)' }}
                  >
                    {t('archive_confirm')}
                  </button>
                </div>
              </div>
            ) : sheet.mode === 'edit' ? (
              <button
                type="button"
                disabled={submitting}
                onClick={() => setConfirmingArchive(true)}
                className="mt-6 min-h-[40px] w-full whitespace-nowrap rounded-full text-[13px] disabled:opacity-50"
                style={{
                  ...CONTROL_FONT,
                  color: 'var(--ob-jar-warm)',
                  border: '1px solid color-mix(in srgb, var(--ob-jar-warm) 30%, transparent)',
                }}
              >
                {t('delete')}
              </button>
            ) : null}
          </>
        ) : null}
      </BottomSheet>
    </div>
  );
}
