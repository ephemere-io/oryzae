'use client';

import { MAX_ACTIVE_QUESTIONS } from '@oryzae/shared';
import { verifyAttrs } from '@oryzae/verify';
import Link from 'next/link';
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
  /** 右上の「閉じる」。モーダルの中（PC）では足元のキャンセルが閉じるので省く。 */
  onClose?: () => void;
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
  const t = useTranslations('entry_questions.picker');
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
      aria-label={t('title')}
      className="flex flex-col overflow-hidden rounded-2xl border"
      style={{ ...ELEVATED_PANEL_STYLE, ...CONTROL_FONT }}
    >
      {/* 見出しは出さない。開いた入口（「問いを結ぶ」）と同じ言葉を中でもう一度言っていた（オーナーの指示）。
          名前は読み上げ（aria-label）にだけ残す。 */}
      {onClose ? (
        <div className="flex items-center justify-end px-4 pt-3 pb-1">
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
      ) : null}

      {composing ? (
        <div className="flex flex-col gap-2 px-4 pb-4">
          {questions.length === 0 ? (
            <p className="pb-1 text-[13px] leading-relaxed opacity-60">{t('empty')}</p>
          ) : null}
          <div className="flex items-center gap-2">
            <Input
              value={newText}
              onChange={setNewText}
              placeholder={t('new_placeholder')}
              ariaLabel={t('new_placeholder')}
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
              {creating ? t('creating') : t('create')}
            </button>
          </div>
          {createFailed ? (
            <p className="text-[12px]" style={{ color: 'var(--ob-jar-warm)' }}>
              {t('create_failed')}
            </p>
          ) : null}
          {questions.length > 0 ? (
            <button
              type="button"
              onClick={() => onComposingChange(false)}
              className="self-start py-1 text-[13px] opacity-60"
            >
              {t('back_to_list')}
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
                placeholder={t('search_placeholder')}
                ariaLabel={t('search_placeholder')}
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
                    // 問いは折り返して全文を出す（1 行で切ると長い問いが読めなかった）。字は選び手の他の字
                    // （見出し・検索欄）と同じ書体で一回り小さく（大きく見えた。実機レビュー）。
                    className="flex min-h-[44px] w-full items-start justify-between gap-3 px-4 py-2.5 text-left text-[14px] leading-snug hover:bg-[var(--hover-wash)]"
                    style={{ color: 'var(--fg)' }}
                  >
                    <span className="min-w-0 flex-1 break-words">
                      {question.currentText ?? t('untitled')}
                    </span>
                    <span
                      aria-hidden="true"
                      className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full border"
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
          {questions.length >= MAX_ACTIVE_QUESTIONS ? (
            // 上限（#430）。書いても作れないので、書く欄を開かせない。
            <div data-question-limit className="flex flex-col items-start gap-1 px-4 py-3">
              <p className="m-0 text-[12px] leading-relaxed" style={{ color: 'var(--date-color)' }}>
                {t('limit', { max: MAX_ACTIVE_QUESTIONS })}
              </p>
              {/* どこで終えるのかを言うだけでは辿れなかった（レビュー）。そこへの入口を置く。 */}
              <Link
                href="/questions"
                data-question-manage
                className="min-h-[36px] py-2 text-[13px] font-medium underline underline-offset-4"
                style={{ color: 'var(--accent)' }}
              >
                {t('manage')}
              </Link>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setCreateFailed(false);
                onComposingChange(true);
              }}
              className="min-h-[44px] w-full px-4 py-2 text-left text-[14px] font-medium"
              style={{ color: 'var(--accent)' }}
            >
              {t('new')}
            </button>
          )}
        </>
      )}
    </section>
  );
}
