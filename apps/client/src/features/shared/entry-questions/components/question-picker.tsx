'use client';

import { MAX_ACTIVE_QUESTIONS } from '@oryzae/shared';
import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ActionRow, type RowAction } from '@/components/ui/action-row';
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
  /** 足元の操作の行の「閉じる」。モーダルの中（PC）ではモーダルの足元のキャンセルが閉じるので省く。 */
  onClose?: () => void;
}

/** これ以上あれば探す欄を出す。 */
const SEARCH_THRESHOLD = 4;

/**
 * 問いを結ぶ選び手。**その場で開く**（暗転するモーダルでも下から出るシートでもない）。
 *
 * shadcn の Combobox / Command の作法: 探す欄 → チェック付きの行（押すたびに結ぶ／外す、
 * 開いたままで複数選べる）。**操作（新しく問いを書く・閉じる）は足元の 1 行に固める**（`ActionRow`、左上中心主義で
 * 左から）。以前は「閉じる」が右上、「新しく問いを書く」が一覧の末尾の文字で、同じ性質の操作が散っていた（実機レビュー）。
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
  const atLimit = questions.length >= MAX_ACTIVE_QUESTIONS;
  const closeAction: RowAction[] = onClose
    ? [{ id: 'close', label: t('close'), tone: 'secondary', onSelect: onClose }]
    : [];

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
      {composing ? (
        <div className="flex flex-col gap-2 px-4 pt-4 pb-4">
          {questions.length === 0 ? (
            <p className="pb-1 text-[13px] leading-relaxed opacity-60">{t('empty')}</p>
          ) : null}
          <Input
            value={newText}
            onChange={setNewText}
            placeholder={t('new_placeholder')}
            ariaLabel={t('new_placeholder')}
            size="md"
            autoFocus
          />
          {createFailed ? (
            <p className="text-[12px]" style={{ color: 'var(--ob-jar-warm)' }}>
              {t('create_failed')}
            </p>
          ) : null}
          <div className="pt-1">
            <ActionRow
              actions={[
                {
                  id: 'create',
                  label: creating ? t('creating') : t('create'),
                  tone: 'primary',
                  disabled: !newText.trim() || creating,
                  onSelect: create,
                },
                ...(questions.length > 0
                  ? [
                      {
                        id: 'back-to-list',
                        label: t('back_to_list'),
                        tone: 'secondary' as const,
                        onSelect: () => onComposingChange(false),
                      },
                    ]
                  : []),
                ...closeAction,
              ]}
            />
          </div>
        </div>
      ) : (
        <>
          {questions.length >= SEARCH_THRESHOLD ? (
            <div className="px-4 pt-3 pb-1">
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
          {atLimit ? (
            // 上限（#430）。書いても作れないので、書く欄を開かせない。
            <p
              data-question-limit
              className="m-0 px-4 pt-2 text-[12px] leading-relaxed"
              style={{ color: 'var(--date-color)' }}
            >
              {t('limit', { max: MAX_ACTIVE_QUESTIONS })}
            </p>
          ) : null}
          <div className="border-t px-4 py-3" style={{ borderColor: 'var(--border-subtle)' }}>
            <ActionRow
              actions={[
                atLimit
                  ? // どこでアーカイブするのかを言うだけでは辿れなかった（レビュー）。そこへの入口を置く。
                    {
                      id: 'manage',
                      label: t('manage'),
                      tone: 'secondary',
                      href: '/questions',
                    }
                  : {
                      id: 'new',
                      label: t('new'),
                      tone: 'primary',
                      onSelect: () => {
                        setCreateFailed(false);
                        onComposingChange(true);
                      },
                    },
                ...closeAction,
              ]}
            />
          </div>
        </>
      )}
    </section>
  );
}
