'use client';

import { MAX_SNIPPET_TEXT_LENGTH } from '@oryzae/shared';
import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

/**
 * 抜粋の本文を書く／直すボトムシート。
 *
 * PC はダイアログ（`SnippetDialog`）だが、SP は**下から出るシート**にする。片手で持つ
 * 画面では、中央のダイアログはキーボードが出た瞬間に押し出されて見えなくなる。
 *
 * 画像から読み取る（OCR）タブは持たない。SP は「その場で書き足す」ための面で、
 * 画像から起こす作業は腰を据えてやるもの（PC 側にある）。
 */

export interface SpSnippetSheetProps {
  open: boolean;
  /** 直すときは元の本文。新しく作るときは空。 */
  initialText?: string;
  /** 保存中は閉じさせない・二重送信させない。 */
  saving?: boolean;
  onSubmit: (text: string) => void;
  onClose: () => void;
}

export function SpSnippetSheet({
  open,
  initialText = '',
  saving = false,
  onSubmit,
  onClose,
}: SpSnippetSheetProps) {
  const t = useTranslations('sp.board');
  const [text, setText] = useState(initialText);

  // 開き直すたびに元の本文へ戻す。閉じてもそのまま残ると、次に別のカードを開いたときに
  // 前のカードの本文が入っている（保存すると取り違える）。
  useEffect(() => {
    if (open) setText(initialText);
  }, [open, initialText]);

  if (!open) return null;

  const trimmed = text.trim();
  const tooLong = text.length > MAX_SNIPPET_TEXT_LENGTH;
  const canSubmit = trimmed.length > 0 && !tooLong && !saving;

  return (
    <div
      {...verifyAttrs({
        unit: 'SpSnippetSheet',
        mode: initialText === '' ? 'create' : 'edit',
        saving,
        empty: trimmed.length === 0,
        tooLong,
      })}
      className="absolute inset-0 z-30 flex flex-col justify-end"
    >
      {/* 背景。押したら閉じる（保存中は閉じさせない）。 */}
      <button
        type="button"
        aria-label={t('cancel')}
        onClick={saving ? undefined : onClose}
        className="sp-fade absolute inset-0"
        style={{ background: 'color-mix(in srgb, var(--fg) 28%, transparent)' }}
      />

      <div
        className="sp-sheet relative rounded-t-3xl px-5 pt-4 pb-6"
        style={{ background: 'var(--bg)', boxShadow: '0 -8px 32px rgba(140,133,126,0.18)' }}
      >
        <div className="mb-3 flex items-center justify-between">
          <span
            className="text-[11px] uppercase tracking-[0.14em]"
            style={{ color: 'var(--accent)', fontFamily: 'var(--ob-font-sans)' }}
          >
            {initialText === '' ? t('add_snippet') : t('edit')}
          </span>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="shrink-0 text-xs disabled:opacity-40"
            style={{ color: 'var(--date-color)' }}
          >
            {t('cancel')}
          </button>
        </div>

        <textarea
          // biome-ignore lint/a11y/noAutofocus: 書くために開くシートなので、開いた瞬間に打てる
          autoFocus
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={t('snippet_placeholder')}
          aria-label={t('snippet_placeholder')}
          rows={5}
          className="w-full resize-none rounded-xl px-3 py-2.5 text-[15px] outline-none"
          style={{
            background: 'var(--ob-card-bg)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--fg)',
            lineHeight: 1.7,
          }}
        />

        <div className="mt-2 flex items-center justify-between">
          {/* 数えるのは上限が近いときだけ。3/2000 を常に出しても読む理由がない。 */}
          <span
            className="text-[11px]"
            style={{ color: tooLong ? 'var(--ob-jar-warm)' : 'var(--date-color)' }}
          >
            {text.length > MAX_SNIPPET_TEXT_LENGTH * 0.8
              ? `${text.length} / ${MAX_SNIPPET_TEXT_LENGTH}`
              : ''}
          </span>
          <button
            type="button"
            onClick={() => canSubmit && onSubmit(trimmed)}
            disabled={!canSubmit}
            className="rounded-full px-6 py-2.5 text-[13px] font-medium text-white disabled:opacity-40"
            style={{ background: 'var(--accent)', fontFamily: 'var(--ob-font-sans)' }}
          >
            {t('save')}
          </button>
        </div>
      </div>
    </div>
  );
}
