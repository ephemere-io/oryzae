'use client';

import { MAX_OCR_IMAGE_BYTES, MAX_SNIPPET_TEXT_LENGTH } from '@oryzae/shared';
import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { CONTROL_FONT } from '@/components/ui/surface';

/** 画像の読み取りの進み。`idle` は読み取っていない（書いている）。 */
export type SpSnippetOcrStatus = 'idle' | 'reading' | 'empty' | 'failed';

export interface SpSnippetSheetProps {
  open: boolean;
  /** 新しく作るか、既にあるカードを直すか。見出しと送り先が変わる。 */
  mode: 'create' | 'edit';
  /** 直すときは元の本文。新しく作るときは空か、画像から読み取った下書き。 */
  initialText?: string;
  /** 保存中は閉じさせない・二重送信させない。 */
  saving?: boolean;
  /** 画像の読み取りの進み。渡さなければ読み取りの UI を出さない。 */
  ocrStatus?: SpSnippetOcrStatus;
  /** 本文が画像から読み取ったものか（誤りが混じりうることを添える）。 */
  fromImage?: boolean;
  /**
   * 画像を選ばせる（端末の写真アプリ／カメラを開く）。ボードが `<input type="file">` を
   * 持ち、押した指の中で開く（後から開くと iOS が拒む）。
   */
  onPickImage?: () => void;
  onSubmit: (text: string) => void;
  onClose: () => void;
}

/**
 * スニペットの本文を書く／直すボトムシート。
 *
 * PC はダイアログ（`SnippetDialog`）だが、SP は**下から出るシート**にする。片手で持つ
 * 画面では、中央のダイアログはキーボードが出た瞬間に押し出されて見えなくなる。
 *
 * **画像から読み取る（OCR）も持つ。** 以前は「腰を据えてやるもの」として PC にだけ
 * 置いていたが、写真を撮るのはむしろスマホなので、無いと「PC の機能が SP で全く
 * 使えない」になる。読み取り結果はそのまま貼らず、必ずこの欄で直してから保存する。
 */
export function SpSnippetSheet({
  open,
  mode,
  initialText = '',
  saving = false,
  ocrStatus = 'idle',
  fromImage = false,
  onPickImage,
  onSubmit,
  onClose,
}: SpSnippetSheetProps) {
  const t = useTranslations('sp.board');
  const tOcr = useTranslations('board.snippet_dialog');
  const [text, setText] = useState(initialText);

  // 開き直すたびに元の本文へ戻す。閉じてもそのまま残ると、次に別のカードを開いたときに
  // 前のカードの本文が入っている（保存すると取り違える）。読み取り結果が届いたときも
  // ここで欄に載る。
  useEffect(() => {
    if (open) setText(initialText);
  }, [open, initialText]);

  if (!open) return null;

  const trimmed = text.trim();
  const tooLong = text.length > MAX_SNIPPET_TEXT_LENGTH;
  const reading = ocrStatus === 'reading';
  const canSubmit = trimmed.length > 0 && !tooLong && !saving && !reading;
  const locked = saving || reading;

  return (
    <div
      {...verifyAttrs({
        unit: 'SpSnippetSheet',
        mode,
        saving,
        empty: trimmed.length === 0,
        tooLong,
        ocrStatus,
        fromImage,
      })}
      className="absolute inset-0 z-30 flex flex-col justify-end"
    >
      {/* 背景。押したら閉じる（保存中・読み取り中は閉じさせない）。 */}
      <button
        type="button"
        aria-label={t('cancel')}
        onClick={locked ? undefined : onClose}
        className="sp-fade absolute inset-0"
        style={{ background: 'color-mix(in srgb, var(--fg) 28%, transparent)' }}
      />

      <div
        className="sp-sheet relative max-h-[85%] overflow-auto rounded-t-3xl px-5 pt-4 pb-6"
        style={{ background: 'var(--bg)', boxShadow: '0 -8px 32px rgba(140,133,126,0.18)' }}
      >
        <div className="mb-3 flex items-center justify-between">
          <span
            className="text-[11px] uppercase tracking-[0.14em]"
            style={{ ...CONTROL_FONT, color: 'var(--accent)' }}
          >
            {mode === 'create' ? t('add_snippet') : t('edit')}
          </span>
          <button
            type="button"
            onClick={onClose}
            disabled={locked}
            className="min-h-[40px] shrink-0 rounded-full border px-4 text-[13px] disabled:opacity-40"
            style={{ ...CONTROL_FONT, color: 'var(--fg)', borderColor: 'var(--border-subtle)' }}
          >
            {t('cancel')}
          </button>
        </div>

        <textarea
          // biome-ignore lint/a11y/noAutofocus: 書くために開くシートなので、開いた瞬間に打てる
          autoFocus
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={reading ? tOcr('reading') : t('snippet_placeholder')}
          aria-label={t('snippet_placeholder')}
          rows={5}
          disabled={reading}
          className="w-full resize-none rounded-xl px-3 py-2.5 text-[15px] outline-none disabled:opacity-60"
          style={{
            background: 'var(--surface-raised)',
            border: '1px solid var(--surface-raised-border)',
            color: 'var(--fg)',
            lineHeight: 1.7,
          }}
        />

        {/* 画像から読み取る。新しく作るときだけ（直すときは本文が主役）。 */}
        {mode === 'create' && onPickImage ? (
          <div className="mt-2 flex flex-col gap-1.5">
            {ocrStatus === 'empty' ? (
              <p className="text-[12px] leading-relaxed" style={{ color: 'var(--ob-jar-warm)' }}>
                {tOcr('ocr_empty')}
              </p>
            ) : null}
            {ocrStatus === 'failed' ? (
              <p className="text-[12px] leading-relaxed" style={{ color: 'var(--ob-jar-warm)' }}>
                {tOcr('ocr_failed', { maxMb: Math.round(MAX_OCR_IMAGE_BYTES / 1024 / 1024) })}
              </p>
            ) : null}
            {fromImage && ocrStatus === 'idle' ? (
              <p className="text-[12px] leading-relaxed" style={{ color: 'var(--date-color)' }}>
                {tOcr('ocr_note')}
              </p>
            ) : null}
            <button
              type="button"
              onClick={onPickImage}
              disabled={locked}
              data-ocr-trigger
              className="flex min-h-[40px] items-center gap-2 self-start rounded-full border px-4 text-[13px] disabled:opacity-40"
              style={{ ...CONTROL_FONT, color: 'var(--fg)', borderColor: 'var(--border-subtle)' }}
            >
              <ScanIcon />
              {reading
                ? tOcr('reading')
                : ocrStatus === 'empty' || ocrStatus === 'failed'
                  ? tOcr('read_again')
                  : t('read_image')}
            </button>
          </div>
        ) : null}

        <div className="mt-3 flex items-center justify-between">
          {/* 数えるのは上限が近いときだけ。3/2000 を常に出しても読む理由がない。 */}
          <span
            className="text-[11px]"
            style={{ ...CONTROL_FONT, color: tooLong ? 'var(--ob-jar-warm)' : 'var(--date-color)' }}
          >
            {text.length > MAX_SNIPPET_TEXT_LENGTH * 0.8
              ? `${text.length} / ${MAX_SNIPPET_TEXT_LENGTH}`
              : ''}
          </span>
          <button
            type="button"
            onClick={() => canSubmit && onSubmit(trimmed)}
            disabled={!canSubmit}
            className="min-h-[40px] rounded-full px-6 text-[13px] font-medium text-white disabled:opacity-40"
            style={{ ...CONTROL_FONT, background: 'var(--accent)' }}
          >
            {t('save')}
          </button>
        </div>
      </div>
    </div>
  );
}

function ScanIcon() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 8V5a2 2 0 0 1 2-2h3" />
      <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
      <path d="M3 16v3a2 2 0 0 0 2 2h3" />
      <path d="M21 16v3a2 2 0 0 1-2 2h-3" />
      <path d="M7 10h10M7 14h6" />
    </svg>
  );
}
