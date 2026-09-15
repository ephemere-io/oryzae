'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { QuestionPicker } from '@/features/shared/entry-questions/components/question-picker';
import type { LinkedQuestion } from '@/features/shared/entry-questions/types';

interface QuestionSelectModalProps {
  open: boolean;
  saving: boolean;
  /** 選べる問い（生きているもの + その場で立てたもの）。 */
  activeQuestions: readonly LinkedQuestion[];
  /** 結んでいる問い。行に印が付く。複数結べる（SP と同じ）。 */
  linkedQuestionIds: ReadonlySet<string>;
  /** 行を押すたびに結ぶ／外す。呼び出し側が即時に反映する。 */
  onToggle: (questionId: string) => void;
  /** その場で問いを立てて結ぶ。作れたら id、作れなければ null。 */
  onCreate: (text: string) => Promise<string | null>;
  /** 結んだ問いで漬け込む（1 つ以上結んでいるときだけ活性）。 */
  onProceed: () => void;
  onClose: () => void;
}

/**
 * Issue #316: 問いが結ばれていないエントリを「漬け込む」ときに出す。
 *
 * 中身は SP と同じ選び手（`QuestionPicker`、shared）。行を押すたびに結ぶ／外す（開いたまま
 * 複数選べる）、末尾でその場に問いを書ける。足元の「紐付けて漬け込む」で漬け込みへ進む。
 * 以前はラジオ + `<select>` で 1 つだけ選ぶ形だった（SP と違っていた）。
 */
export function QuestionSelectModal({
  open,
  saving,
  activeQuestions,
  linkedQuestionIds,
  onToggle,
  onCreate,
  onProceed,
  onClose,
}: QuestionSelectModalProps) {
  const t = useTranslations('editor.question_select_modal');
  // 「書く」に切り替えたい意思だけを持ち、実際のモードは問いの有無から導く（SP と同じ）。
  const [composeRequested, setComposeRequested] = useState(false);
  const composing = composeRequested || activeQuestions.length === 0;

  useEffect(() => {
    if (open) setComposeRequested(false);
  }, [open]);

  if (!open) return null;

  const linkedCount = Array.from(linkedQuestionIds).filter((id) =>
    activeQuestions.some((q) => q.id === id),
  ).length;
  const canProceed = linkedCount > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('aria_label')}
      className="fixed inset-0 z-[2000] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
      {...verifyAttrs({
        unit: 'QuestionSelectModal',
        open,
        saving,
        composing,
        questionCount: activeQuestions.length,
        linkedCount,
        canProceed,
      })}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (canProceed && !saving) onProceed();
        }}
        className="flex w-[90%] max-w-[440px] flex-col gap-4 rounded-xl shadow-lg"
        style={{ backgroundColor: 'var(--bg)', padding: '24px 24px 20px' }}
      >
        <div>
          <h3 className="mb-2 text-sm font-semibold" style={{ color: 'var(--fg)' }}>
            {t('heading')}
          </h3>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--fg)' }}>
            {t('body')}
          </p>
        </div>

        <QuestionPicker
          questions={activeQuestions}
          selectedIds={Array.from(linkedQuestionIds)}
          onToggle={onToggle}
          onCreate={onCreate}
          composing={composing}
          onComposingChange={setComposeRequested}
        />

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border px-4 py-2 text-xs"
            style={{
              borderColor: 'var(--border-subtle)',
              color: 'var(--fg)',
              backgroundColor: 'var(--bg)',
            }}
          >
            {t('cancel')}
          </button>
          <button
            type="submit"
            disabled={saving || !canProceed}
            className="rounded-md border px-4 py-2 text-xs text-white disabled:opacity-40"
            style={{ backgroundColor: 'var(--accent)', borderColor: 'var(--accent)' }}
          >
            {saving ? t('saving') : t('confirm')}
          </button>
        </div>
      </form>
    </div>
  );
}
