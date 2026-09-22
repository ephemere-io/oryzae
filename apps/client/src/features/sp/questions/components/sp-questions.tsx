'use client';

import { MAX_ACTIVE_QUESTIONS } from '@oryzae/shared';
import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ActionRow } from '@/components/ui/action-row';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { CONTROL_FONT } from '@/components/ui/surface';
import type { QuestionItem } from '@/features/shared/questions/types';
import { SpQuestionsCardsSkeleton } from '@/features/sp/questions/components/sp-questions-skeleton';
import { useSpBackHandler, useSpChrome } from '@/lib/sp-chrome-context';

interface SpQuestionsProps {
  questions: QuestionItem[];
  loading: boolean;
  /** 送れたか（`false` なら失敗として画面に出す。何も返さないものは成功とみなす）。 */
  createQuestion: (text: string) => Promise<boolean | void> | boolean | void;
  editQuestion: (id: string, text: string) => Promise<boolean | void> | boolean | void;
  archiveQuestion: (id: string) => Promise<boolean | void> | boolean | void;
  /** アーカイブした問いを戻す。無ければ戻す一覧を出さない。 */
  unarchiveQuestion?: (id: string) => Promise<boolean | void> | boolean | void;
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
  unarchiveQuestion,
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
   * 送れなかった（通信が落ちた・サーバーが断った）。**シートは閉じない**で理由を出す。以前は送信中のまま戻らず、
   * 何を押しても動かない画面になった（実機レビュー: 保存を押したら画面が変わらない）。
   */
  const [failed, setFailed] = useState(false);
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
  const archived = questions.filter((q) => q.isArchived);
  /** アーカイブした問いの一覧を開いているか（ふだんは畳む）。 */
  const [archivedOpen, setArchivedOpen] = useState(false);
  // 上限（#430）なら「立てる」を出さず、理由を言う。押せるのに何も起きない、をやめる（レビュー）。
  const atLimit = active.length >= MAX_ACTIVE_QUESTIONS;

  function openAdd() {
    setConfirmingArchive(false);
    setFailed(false);
    setDraft('');
    setSheet({ mode: 'add' });
  }
  function openEdit(id: string, text: string) {
    setConfirmingArchive(false);
    setFailed(false);
    setDraft(text);
    setSheet({ mode: 'edit', id });
  }

  /** 送って、送れたらシートを閉じる。失敗しても必ず送信中を解く（固まらせない）。 */
  async function run(action: () => Promise<boolean | void> | boolean | void) {
    setSubmitting(true);
    setFailed(false);
    try {
      return (await action()) !== false;
    } catch {
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  async function submit() {
    if (!draft.trim() || submitting || !sheet) return;
    const ok = await run(() =>
      sheet.mode === 'add' ? createQuestion(draft.trim()) : editQuestion(sheet.id, draft.trim()),
    );
    if (ok) setSheet(null);
    else setFailed(true);
  }

  async function remove() {
    if (sheet?.mode !== 'edit' || submitting) return;
    const ok = await run(() => archiveQuestion(sheet.id));
    if (!ok) {
      setFailed(true);
      return;
    }
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

          {/* 上限（#430）なら「立てる」を出さない。説明の箱は置かない: 一覧を開けば 5 つ並んでいるのが
              見えるので、言葉で言い直すとかえってややこしい（オーナーのレビュー）。 */}
          {atLimit ? null : (
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
          {/* アーカイブした問い。畳んでおき、開けば戻せる（アーカイブを取り返しのつく操作にする）。 */}
          {unarchiveQuestion && archived.length > 0 ? (
            <div className="mt-6 border-t pt-4" style={{ borderColor: 'var(--border-subtle)' }}>
              <button
                type="button"
                data-archived-toggle
                aria-expanded={archivedOpen}
                onClick={() => setArchivedOpen((value) => !value)}
                className="flex min-h-[44px] w-full items-center justify-between text-left text-[13px]"
                style={{ ...CONTROL_FONT, color: 'var(--date-color)' }}
              >
                <span>{t('archived_section', { count: archived.length })}</span>
                <span aria-hidden="true" className="oz-disclosure-mark" data-open={archivedOpen} />
              </button>
              {archivedOpen ? (
                <ul className="m-0 flex list-none flex-col p-0" data-archived-list>
                  {atLimit ? (
                    <li
                      className="pb-2 text-[12px] leading-relaxed"
                      style={{ ...CONTROL_FONT, color: 'var(--date-color)' }}
                    >
                      {t('unarchive_limit', { max: MAX_ACTIVE_QUESTIONS })}
                    </li>
                  ) : null}
                  {archived.map((q) => (
                    <li
                      key={q.id}
                      className="flex items-center justify-between gap-3 border-b py-3 last:border-b-0"
                      style={{ borderColor: 'var(--border-subtle)' }}
                    >
                      <span className="min-w-0 flex-1 text-[14px] leading-relaxed opacity-70">
                        {q.currentText ?? t('untitled')}
                      </span>
                      <button
                        type="button"
                        data-unarchive={q.id}
                        disabled={submitting || atLimit}
                        onClick={() => void run(() => unarchiveQuestion(q.id))}
                        className="min-h-[36px] shrink-0 rounded-full border px-4 text-[12px] disabled:opacity-40"
                        style={{
                          ...CONTROL_FONT,
                          color: 'var(--accent)',
                          borderColor: 'color-mix(in srgb, var(--accent) 40%, transparent)',
                        }}
                      >
                        {t('unarchive')}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      {/* 追加 / 編集。キーボードが出るので高い段から開く。 */}
      <BottomSheet
        open={sheet !== null}
        onClose={() => setSheet(null)}
        ariaLabel={sheet?.mode === 'edit' ? t('sheet_edit') : t('sheet_add')}
        label={sheet?.mode === 'edit' ? t('sheet_edit') : t('sheet_add')}
        closeLabel={t('cancel')}
        // キャンセルは操作の行に固める（見出しには名前だけ）。
        closeInHeader={false}
        // 段は中身と全画面。最初の段はいちばん低い段（ブラウザの吸着が選ぶのもここ）。
        // 覗く段（見出しだけ）は置かない: 書くためのシートで見出しだけの段に用は無く、閉の位置に近すぎて
        // 「引っ張ろうとしただけで落ちる」（実機レビュー）。閉じるのはいちばん下まで引き下げたとき。
        detents={['content', 'full']}
        initialDetent="content"
      >
        {sheet ? (
          <>
            {/* **フォーカスは当てない。** iOS はフォーカスした要素を見せようとして祖先を勝手に送るので、
                出たばかりのシートが上へ滑っていく（実機レビュー: 小さいバーが上にスーッと移動する）。
                `preventScroll` を付けても、effect で当てるとキーボードが出ない（指の操作と地続きでない
                フォーカスでは iOS はキーボードを出さない）。書く欄を押せばキーボードは出る。 */}
            <textarea
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
            {failed ? (
              <p
                data-save-failed
                className="m-0 pt-2 text-[12px] leading-relaxed"
                style={{ ...CONTROL_FONT, color: 'var(--ob-jar-warm)' }}
              >
                {t('save_failed')}
              </p>
            ) : null}
            {/*
              操作は書く欄のすぐ下の 1 行に固める（左上中心主義: 左からいちばん押してほしい「保存」、「キャンセル」、
              押されたくない「アーカイブ」は右端）。以前は保存とキャンセルが見出し、アーカイブが離れた下、と散っていた。
              アーカイブは同じ行が確かめに変わる（面を敷かない）。
            */}
            {sheet.mode === 'edit' && confirmingArchive ? (
              <div data-archive-confirm className="mt-4 flex flex-col gap-3" style={CONTROL_FONT}>
                <div className="flex flex-col gap-1">
                  <p className="m-0 text-[14px] font-medium" style={{ color: 'var(--fg)' }}>
                    {t('archive_confirm_title')}
                  </p>
                  <p
                    className="m-0 text-[12px] leading-relaxed"
                    style={{ color: 'var(--date-color)' }}
                  >
                    {t('archive_confirm_body')}
                  </p>
                </div>
                <ActionRow
                  actions={[
                    {
                      id: 'archive-cancel',
                      label: t('archive_cancel'),
                      tone: 'secondary',
                      disabled: submitting,
                      onSelect: () => setConfirmingArchive(false),
                    },
                    {
                      id: 'archive-confirm',
                      label: t('archive_confirm'),
                      tone: 'danger',
                      disabled: submitting,
                      icon: <ArchiveIcon />,
                      onSelect: remove,
                    },
                  ]}
                />
              </div>
            ) : (
              <div className="mt-4">
                <ActionRow
                  actions={[
                    {
                      id: 'save',
                      label: t('save'),
                      tone: 'primary',
                      disabled: submitting || !draft.trim(),
                      onSelect: submit,
                    },
                    {
                      id: 'cancel',
                      label: t('cancel'),
                      tone: 'secondary',
                      onSelect: () => setSheet(null),
                    },
                    ...(sheet.mode === 'edit'
                      ? [
                          {
                            id: 'archive',
                            label: t('archive'),
                            tone: 'danger' as const,
                            disabled: submitting,
                            icon: <ArchiveIcon />,
                            onSelect: () => setConfirmingArchive(true),
                          },
                        ]
                      : []),
                  ]}
                />
              </div>
            )}
          </>
        ) : null}
      </BottomSheet>
    </div>
  );
}

function ArchiveIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
    >
      <path d="M4 7h16v3H4zM6 10v9h12v-9M10 14h4" strokeLinejoin="round" />
    </svg>
  );
}
