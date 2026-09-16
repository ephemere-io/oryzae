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

/**
 * 問い（その人の言葉）の書体。道具の字（`CONTROL_FONT`）と混ぜない。エントリーの本文と同じ明朝で、
 * 選び手の中でも「自分の言葉を選んでいる」ことが見た目で続く（実機レビュー: 画面の中で書体が 2 つに割れていた）。
 */
const SERIF_FONT = "'Noto Serif JP', serif";

/**
 * 問いを結ぶ選び手。**その場で開く**（暗転するモーダルでも下から出るシートでもない）。
 *
 * チェック付きの行（押すたびに結ぶ／外す、開いたままで複数選べる）と、足元の操作の 1 行だけ（`ActionRow`、
 * 左上中心主義で左から）。**探す欄は置かない**: 問いは最大 5 つ（`MAX_ACTIVE_QUESTIONS`）で、探すより全部見える
 * ほうが早い（実機レビュー）。以前は「閉じる」が右上、「新しく問いを書く」が一覧の末尾の文字で、同じ性質の操作が
 * 散っていた。
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
  const [newText, setNewText] = useState('');
  const [creating, setCreating] = useState(false);
  const [createFailed, setCreateFailed] = useState(false);

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
      // 中の字は本文と同じ明朝（問いは「その人の言葉」）。道具の字は操作の行と案内だけが持つ。
      style={{ ...ELEVATED_PANEL_STYLE, fontFamily: SERIF_FONT }}
    >
      {composing ? (
        <div className="flex flex-col gap-2 px-4 pt-4 pb-4">
          {questions.length === 0 ? (
            <p className="pb-1 text-[13px] leading-relaxed opacity-60" style={CONTROL_FONT}>
              {t('empty')}
            </p>
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
            <p className="text-[12px]" style={{ ...CONTROL_FONT, color: 'var(--ob-jar-warm)' }}>
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
          <ul className="max-h-[40vh] overflow-auto py-1 pt-2">
            {questions.map((question) => {
              const on = selected.has(question.id);
              return (
                <li key={question.id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => onToggle(question.id)}
                    // 問いは折り返して全文を出す（1 行で切ると長い問いが読めなかった）。書体は本文と同じ明朝。
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
              style={{ ...CONTROL_FONT, color: 'var(--date-color)' }}
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
