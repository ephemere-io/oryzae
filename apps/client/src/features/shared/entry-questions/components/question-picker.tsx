'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { CONTROL_FONT, ELEVATED_PANEL_STYLE } from '@/components/ui/surface';
import type { LinkedQuestion } from '../types';

export interface QuestionPickerProps {
  /** 選べる問い（生きているもの）。 */
  questions: readonly LinkedQuestion[];
  /** 結んでいる問い。**複数**（PC と同じ。1 つに限らない）。 */
  selectedIds: readonly string[];
  onToggle: (questionId: string) => void;
  /** その場で問いを立てる。作れたら id、作れなければ null。 */
  onCreate: (text: string) => Promise<string | null>;
  /** 書く欄を出しているか（問いが 1 つも無ければ呼び出し側が true にする）。 */
  composing: boolean;
  onComposingChange: (composing: boolean) => void;
  onClose: () => void;
}

/** これ以上あれば探す欄を出す。 */
const SEARCH_THRESHOLD = 4;

/**
 * 問いを結ぶ選び手。**その場で開く**（暗転するモーダルでも下から出るシートでもない）。
 *
 * shadcn の Combobox / Command の作法: 探す欄 → チェック付きの行（押すたびに結ぶ／外す、
 * 開いたままで複数選べる）→ 末尾に「新しく問いを書く」。閉じるのは右上の「閉じる」か、
 * 呼び出し側の戻る。
 *
 * PC と SP で同じ部品にするために `features/shared` に置く（端末は判定しない）。
 */
export function QuestionPicker({
  questions,
  selectedIds,
  onToggle,
  onCreate,
  composing,
  onComposingChange,
  onClose,
}: QuestionPickerProps) {
  const t = useTranslations('sp.editor');
  const [search, setSearch] = useState('');
  const [newText, setNewText] = useState('');
  const [creating, setCreating] = useState(false);
  const [createFailed, setCreateFailed] = useState(false);

  const query = search.trim();
  const visible = query
    ? questions.filter((question) => (question.currentText ?? '').includes(query))
    : questions;
  const selected = new Set(selectedIds);

  async function create() {
    const text = newText.trim();
    if (!text || creating) return;
    setCreating(true);
    setCreateFailed(false);
    const id = await onCreate(text);
    setCreating(false);
    if (!id) {
      setCreateFailed(true);
      return;
    }
    setNewText('');
  }

  return (
    <section
      {...verifyAttrs({
        unit: 'QuestionPicker',
        composing,
        questionCount: questions.length,
        selectedCount: selectedIds.length,
      })}
      aria-label={t('question_sheet_title')}
      className="flex flex-col overflow-hidden rounded-2xl border"
      style={{ ...ELEVATED_PANEL_STYLE, ...CONTROL_FONT }}
    >
      <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-1">
        <span
          className="text-[11px] uppercase tracking-[0.14em]"
          style={{ color: 'var(--accent)' }}
        >
          {t('question_sheet_title')}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('close')}
          className="min-h-[36px] shrink-0 rounded-full border px-3.5 text-[13px]"
          style={{ color: 'var(--fg)', borderColor: 'var(--border-subtle)' }}
        >
          {t('close')}
        </button>
      </div>

      {composing ? (
        <div className="flex flex-col gap-2 px-4 pb-4">
          {questions.length === 0 ? (
            <p className="pb-1 text-[13px] leading-relaxed opacity-60">{t('question_empty')}</p>
          ) : null}
          <div className="flex items-center gap-2">
            <Input
              value={newText}
              onChange={setNewText}
              placeholder={t('question_new_placeholder')}
              ariaLabel={t('question_new_placeholder')}
              size="md"
              autoFocus
              className="min-w-0 flex-1"
            />
            <button
              type="button"
              onClick={create}
              disabled={!newText.trim() || creating}
              data-picker-create
              className="h-11 shrink-0 rounded-xl px-4 text-[14px] font-medium disabled:opacity-40"
              style={{ background: 'var(--accent)', color: 'var(--bg)' }}
            >
              {creating ? t('question_creating') : t('question_create')}
            </button>
          </div>
          {createFailed ? (
            <p className="text-[12px]" style={{ color: 'var(--ob-jar-warm)' }}>
              {t('question_create_failed')}
            </p>
          ) : null}
          {questions.length > 0 ? (
            <button
              type="button"
              onClick={() => onComposingChange(false)}
              className="self-start py-1 text-[13px] opacity-60"
            >
              {t('question_back_to_list')}
            </button>
          ) : null}
        </div>
      ) : (
        <>
          {questions.length >= SEARCH_THRESHOLD ? (
            <div className="px-4 pb-1">
              <Input
                type="search"
                value={search}
                onChange={setSearch}
                placeholder={t('question_search_placeholder')}
                ariaLabel={t('question_search_placeholder')}
                size="md"
              />
            </div>
          ) : null}
          <ul className="max-h-[40vh] overflow-auto py-1">
            {visible.map((question) => {
              const on = selected.has(question.id);
              return (
                <li key={question.id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => onToggle(question.id)}
                    className="flex min-h-[44px] w-full items-center justify-between gap-3 px-4 py-2 text-left hover:bg-[var(--hover-wash)]"
                    style={{
                      fontFamily: "'Noto Serif JP', serif",
                      fontSize: 15,
                      color: 'var(--fg)',
                    }}
                  >
                    <span className="min-w-0 truncate">
                      {question.currentText ?? t('question_untitled')}
                    </span>
                    <span
                      aria-hidden="true"
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border"
                      style={{
                        borderColor: on ? 'var(--accent)' : 'var(--border-subtle)',
                        background: on ? 'var(--accent)' : 'transparent',
                        color: 'var(--bg)',
                      }}
                    >
                      {on ? (
                        <svg
                          aria-hidden="true"
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="m5 12 5 5L20 7" />
                        </svg>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={() => {
              setCreateFailed(false);
              onComposingChange(true);
            }}
            className="min-h-[44px] w-full px-4 py-2 text-left text-[14px] font-medium"
            style={{ color: 'var(--accent)' }}
          >
            {t('question_new')}
          </button>
        </>
      )}
    </section>
  );
}
