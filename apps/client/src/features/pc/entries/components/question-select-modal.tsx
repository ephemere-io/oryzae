'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

interface QuestionOption {
  id: string;
  currentText: string | null;
}

interface QuestionSelectModalProps {
  open: boolean;
  saving: boolean;
  /** Existing active questions to pick from. */
  activeQuestions: QuestionOption[];
  /** Already-linked question IDs (filtered out of the picker). */
  linkedQuestionIds: Set<string>;
  /**
   * Confirm handler. Either selects an existing question (existingId) or
   * creates a new one with the given text (newQuestionText). Exactly one of
   * the two arguments will be non-null. The caller is responsible for
   * (1) creating the question on the server when newQuestionText is given,
   * (2) linking it to the entry, and (3) running the pickle save.
   */
  onConfirm: (args: { existingId: string | null; newQuestionText: string | null }) => void;
  onClose: () => void;
}

/**
 * Issue #316: タイトルがあっても問いが紐付いていないエントリを「漬け込む」
 * 際に表示する。既存の問いがあればリストから選び、なければその場で書く。
 * 選択/入力後は呼び出し側で create+link+pickle を行う。
 */
export function QuestionSelectModal({
  open,
  saving,
  activeQuestions,
  linkedQuestionIds,
  onConfirm,
  onClose,
}: QuestionSelectModalProps) {
  const t = useTranslations('editor.question_select_modal');
  const available = activeQuestions.filter((q) => !linkedQuestionIds.has(q.id));
  const [mode, setMode] = useState<'pick' | 'create'>(available.length > 0 ? 'pick' : 'create');
  const [selectedId, setSelectedId] = useState<string>('');
  const [newText, setNewText] = useState('');
  const newTextRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setMode(available.length > 0 ? 'pick' : 'create');
    setSelectedId('');
    setNewText('');
    if (available.length === 0) {
      setTimeout(() => newTextRef.current?.focus(), 50);
    }
  }, [open, available.length]);

  if (!open) return null;

  const trimmedNew = newText.trim();
  const canConfirm = mode === 'pick' ? selectedId !== '' : trimmedNew.length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canConfirm) return;
    if (mode === 'pick') {
      onConfirm({ existingId: selectedId, newQuestionText: null });
    } else {
      onConfirm({ existingId: null, newQuestionText: trimmedNew });
    }
  };

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
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="w-[90%] max-w-[440px] rounded-xl shadow-lg"
        style={{ backgroundColor: 'var(--bg)', padding: '28px 32px' }}
      >
        <h3 className="mb-3 text-sm font-semibold" style={{ color: 'var(--fg)' }}>
          {t('heading')}
        </h3>
        <p className="mb-4 text-xs leading-relaxed" style={{ color: 'var(--fg)' }}>
          {t('body')}
        </p>

        {available.length > 0 && (
          <div className="mb-3 flex gap-3 text-xs" style={{ color: 'var(--fg)' }}>
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="qmode"
                value="pick"
                checked={mode === 'pick'}
                onChange={() => setMode('pick')}
              />
              {t('mode_pick')}
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="qmode"
                value="create"
                checked={mode === 'create'}
                onChange={() => setMode('create')}
              />
              {t('mode_create')}
            </label>
          </div>
        )}

        {mode === 'pick' && available.length > 0 ? (
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="mb-4 w-full rounded-md border px-3 py-2.5 text-sm outline-none"
            style={{
              backgroundColor: 'var(--bg)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--fg)',
            }}
          >
            <option value="">{t('pick_placeholder')}</option>
            {available.map((q) => (
              <option key={q.id} value={q.id}>
                {q.currentText}
              </option>
            ))}
          </select>
        ) : (
          <input
            ref={newTextRef}
            type="text"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => {
              // IME 確定の Enter で誤送信を避ける
              if (e.key === 'Enter' && e.nativeEvent.isComposing) {
                e.preventDefault();
              }
            }}
            maxLength={64}
            placeholder={t('create_placeholder')}
            className="mb-4 w-full rounded-md border px-3 py-2.5 text-sm outline-none"
            style={{
              backgroundColor: 'var(--bg)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--fg)',
            }}
          />
        )}

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
            disabled={saving || !canConfirm}
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
