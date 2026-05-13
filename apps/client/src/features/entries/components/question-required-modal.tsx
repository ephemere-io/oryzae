'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

interface QuestionOption {
  id: string;
  currentText: string | null;
}

interface QuestionRequiredModalProps {
  open: boolean;
  /** Existing active questions the user can pick from. */
  activeQuestions: QuestionOption[];
  /** Pick an existing question. The caller is expected to link it to the editing entry. */
  onSelect: (questionId: string) => void;
  /** Create a new question with the given text, then link it. */
  onCreate: (text: string) => Promise<void>;
  /**
   * Whether the modal is dismissable.
   *  - On `entry/new` opening: false (the user must pick a question before writing)
   *  - When a draft already has content and we just want to nudge: caller may pass true
   *
   * Defaults to false (blocking).
   */
  dismissable?: boolean;
  onDismiss?: () => void;
  /** Body message variant — "open" (just opened the page) vs "save_attempt" (tried to pickle). */
  variant?: 'open' | 'save_attempt';
}

/**
 * Issue #314 — entries must have a linked question before being saved/pickled.
 * Shown whenever the editor is opened against an entry with no linked question,
 * or when the user tries to pickle without one.
 */
export function QuestionRequiredModal({
  open,
  activeQuestions,
  onSelect,
  onCreate,
  dismissable = false,
  onDismiss,
  variant = 'open',
}: QuestionRequiredModalProps) {
  const t = useTranslations('editor.question_required');
  const [selected, setSelected] = useState<string>('');
  const [draft, setDraft] = useState('');
  const [mode, setMode] = useState<'pick' | 'create'>('pick');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset internal state every time the modal (re)opens.
  useEffect(() => {
    if (!open) return;
    setSelected('');
    setDraft('');
    setSubmitting(false);
    // If no questions exist yet, jump straight to "create" mode.
    setMode(activeQuestions.length === 0 ? 'create' : 'pick');
  }, [open, activeQuestions.length]);

  useEffect(() => {
    if (open && mode === 'create') {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, mode]);

  if (!open) return null;

  const trimmed = draft.trim();
  const createValid = trimmed.length > 0 && trimmed.length <= 64;
  const canSubmit = mode === 'pick' ? !!selected : createValid;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (mode === 'pick') {
      if (!selected) return;
      onSelect(selected);
      return;
    }
    if (!createValid) return;
    setSubmitting(true);
    try {
      await onCreate(trimmed);
    } finally {
      setSubmitting(false);
    }
  }

  function handleBackdropClick() {
    if (dismissable && onDismiss) onDismiss();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('aria_label')}
      className="fixed inset-0 z-[2500] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
      onClick={handleBackdropClick}
      onKeyDown={(e) => {
        if (dismissable && e.key === 'Escape' && onDismiss) onDismiss();
      }}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="w-[92%] max-w-[440px] rounded-xl shadow-2xl"
        style={{ backgroundColor: 'var(--bg)', padding: '32px 36px' }}
      >
        <h3 className="mb-1 text-base font-semibold" style={{ color: 'var(--fg)' }}>
          {t('heading')}
        </h3>
        <p className="mb-5 text-xs leading-relaxed" style={{ color: 'var(--date-color)' }}>
          {variant === 'save_attempt' ? t('body_save_attempt') : t('body_open')}
        </p>

        {activeQuestions.length > 0 && (
          <div className="mb-4">
            <div className="mb-2 flex items-center gap-3 text-xs">
              <button
                type="button"
                onClick={() => setMode('pick')}
                className="text-xs underline-offset-2"
                style={{
                  color: mode === 'pick' ? 'var(--accent)' : 'var(--date-color)',
                  textDecoration: mode === 'pick' ? 'underline' : 'none',
                }}
              >
                {t('tab_pick')}
              </button>
              <span style={{ color: 'var(--border-subtle)' }}>/</span>
              <button
                type="button"
                onClick={() => setMode('create')}
                className="text-xs underline-offset-2"
                style={{
                  color: mode === 'create' ? 'var(--accent)' : 'var(--date-color)',
                  textDecoration: mode === 'create' ? 'underline' : 'none',
                }}
              >
                {t('tab_create')}
              </button>
            </div>
          </div>
        )}

        {mode === 'pick' && activeQuestions.length > 0 && (
          <div
            className="mb-5 max-h-[240px] overflow-y-auto rounded-md border"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <ul>
              {activeQuestions.map((q) => (
                <li key={q.id}>
                  <label
                    className="flex cursor-pointer items-start gap-2 px-3 py-2 text-sm hover:bg-[var(--toolbar-hover)]"
                    style={{ color: 'var(--fg)' }}
                  >
                    <input
                      type="radio"
                      name="question"
                      value={q.id}
                      checked={selected === q.id}
                      onChange={() => setSelected(q.id)}
                      className="mt-1"
                    />
                    <span className="break-words">{q.currentText}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}

        {mode === 'create' && (
          <div className="mb-5">
            <label
              className="mb-1.5 block text-xs"
              style={{ color: 'var(--date-color)' }}
              htmlFor="question-required-input"
            >
              {t('create_label')}
            </label>
            <input
              ref={inputRef}
              id="question-required-input"
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                // IME 変換確定の Enter で送信されないようにする (entry-editor と同じ慣例)
                if (e.key === 'Enter' && e.nativeEvent.isComposing) {
                  e.preventDefault();
                }
              }}
              maxLength={64}
              placeholder={t('create_placeholder')}
              className="w-full rounded-md border px-3 py-2.5 text-sm outline-none"
              style={{
                backgroundColor: 'var(--bg)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--fg)',
              }}
            />
            <div className="mt-1 text-right text-[10px]" style={{ color: 'var(--date-color)' }}>
              {draft.length}/64
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          {dismissable && onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-md border px-4 py-2 text-xs"
              style={{
                borderColor: 'var(--border-subtle)',
                color: 'var(--fg)',
                backgroundColor: 'var(--bg)',
              }}
            >
              {t('cancel')}
            </button>
          )}
          <button
            type="submit"
            disabled={!canSubmit || submitting}
            className="rounded-md border px-4 py-2 text-xs text-white disabled:opacity-40"
            style={{ backgroundColor: 'var(--accent)', borderColor: 'var(--accent)' }}
          >
            {submitting ? t('submitting') : t('submit')}
          </button>
        </div>
      </form>
    </div>
  );
}
