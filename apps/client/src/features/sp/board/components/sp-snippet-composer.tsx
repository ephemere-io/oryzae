'use client';

import { MAX_OCR_IMAGE_BYTES, MAX_SNIPPET_TEXT_LENGTH } from '@oryzae/shared';
import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { ScanTextIcon } from '@/components/ui/palette-icons';
import { CONTROL_FONT, ICON_STROKE_WIDTH } from '@/components/ui/surface';

/** 画像の読み取りの進み。`idle` は読み取っていない（書いている）。 */
export type SpSnippetOcrStatus = 'idle' | 'reading' | 'empty' | 'failed';

export interface SpSnippetComposerProps {
  open: boolean;
  /** 新しく作るか、既にあるカードを直すか。送るボタンの印が変わる。 */
  mode: 'create' | 'edit';
  /** 直すときは元の本文。新しく作るときは空か、画像から読み取った下書き。 */
  initialText?: string;
  /** 保存中は閉じさせない・二重送信させない。 */
  saving?: boolean;
  /** 画像の読み取りの進み。 */
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

/** 欄が伸びる上限（px）。5 行ほど。それ以上は欄の中でスクロール。 */
const MAX_FIELD_HEIGHT = 140;

/**
 * スニペットを書く／直す欄。**キーボードの真上に張り付く 1 行の入力**（メッセージアプリの作法）。
 *
 * 以前は下から出るシート（見出し「スニペットを作成」・キャンセル・大きな欄・保存）だったが、
 * キーボードが出るとシートごと隠れて欄が見えず、見出しは「作成」と名乗るだけで役に立たなかった
 * （実機レビュー）。殻（`SpShell`）の下端の席に置くと、殻がビジュアルビューポートに追従するので
 * 欄は常にキーボードの上に出る。見出しは置かず、プレースホルダーだけで足りる。
 *
 * 左に画像から読み取る（新しく作るときだけ）、右に送る。欄は書いた分だけ伸びる。
 * 閉じるのは上段の戻るか、盤面を押す（ボードが担う）。
 */
export function SpSnippetComposer({
  open,
  mode,
  initialText = '',
  saving = false,
  ocrStatus = 'idle',
  fromImage = false,
  onPickImage,
  onSubmit,
  onClose,
}: SpSnippetComposerProps) {
  const t = useTranslations('sp.board');
  const tOcr = useTranslations('board.snippet_dialog');
  const [text, setText] = useState(initialText);
  const fieldRef = useRef<HTMLTextAreaElement>(null);

  // 開き直すたびに元の本文へ戻す。閉じてもそのまま残ると、次に別のカードを開いたときに
  // 前のカードの本文が入っている。読み取り結果が届いたときもここで欄に載る。
  useEffect(() => {
    if (open) setText(initialText);
  }, [open, initialText]);

  // 書いた分だけ伸びる。`rows` は使わず scrollHeight に合わせる。
  useEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    field.style.height = 'auto';
    field.style.height = `${Math.min(field.scrollHeight, MAX_FIELD_HEIGHT)}px`;
  });

  if (!open) return null;

  const trimmed = text.trim();
  const tooLong = text.length > MAX_SNIPPET_TEXT_LENGTH;
  const reading = ocrStatus === 'reading';
  const canSubmit = trimmed.length > 0 && !tooLong && !saving && !reading;
  const locked = saving || reading;
  const note =
    ocrStatus === 'reading'
      ? t('ocr_wait_note')
      : ocrStatus === 'empty'
        ? tOcr('ocr_empty')
        : ocrStatus === 'failed'
          ? tOcr('ocr_failed', { maxMb: Math.round(MAX_OCR_IMAGE_BYTES / 1024 / 1024) })
          : fromImage
            ? tOcr('ocr_note')
            : tooLong
              ? tOcr('too_long', { max: MAX_SNIPPET_TEXT_LENGTH })
              : null;
  const noteTone =
    ocrStatus === 'reading' || (fromImage && ocrStatus === 'idle' && !tooLong)
      ? 'var(--date-color)'
      : 'var(--ob-jar-warm)';

  return (
    <div
      {...verifyAttrs({
        unit: 'SpSnippetComposer',
        mode,
        saving,
        empty: trimmed.length === 0,
        tooLong,
        ocrStatus,
        fromImage,
      })}
      role="dialog"
      aria-label={mode === 'create' ? t('add_snippet') : t('edit')}
      className="flex flex-col gap-1.5 px-3 pt-2"
      style={{
        ...CONTROL_FONT,
        paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 0px))',
        background: 'var(--surface-raised)',
        borderTop: '1px solid var(--surface-raised-border)',
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !locked) onClose();
      }}
    >
      {note ? (
        <p className="px-1 text-[12px] leading-relaxed" style={{ color: noteTone }}>
          {note}
        </p>
      ) : null}

      <div className="flex items-end gap-2">
        {/* 画像から読み取る。新しく作るときだけ（直すときは本文が主役）。 */}
        {mode === 'create' && onPickImage ? (
          <button
            type="button"
            onClick={onPickImage}
            disabled={locked}
            data-ocr-trigger
            aria-label={
              ocrStatus === 'empty' || ocrStatus === 'failed' ? tOcr('read_again') : t('read_image')
            }
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[var(--hover-wash)] active:scale-95 disabled:opacity-40"
            style={{ color: 'var(--fg)' }}
          >
            <ScanTextIcon />
          </button>
        ) : null}

        <textarea
          ref={fieldRef}
          // biome-ignore lint/a11y/noAutofocus: 書くために開く欄なので、開いた瞬間に打てる
          autoFocus
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={reading ? tOcr('reading') : t('snippet_placeholder')}
          aria-label={t('snippet_placeholder')}
          rows={1}
          disabled={reading}
          className={`min-h-[44px] flex-1 resize-none rounded-[22px] px-4 py-[11px] text-[16px] outline-none disabled:opacity-60 ${
            reading ? 'animate-pulse' : ''
          }`}
          style={{
            background: 'var(--surface-sunken)',
            border: `1px solid ${tooLong ? 'var(--ob-jar-warm)' : 'var(--surface-sunken-border)'}`,
            color: 'var(--fg)',
            lineHeight: 1.4,
            fontFamily: 'inherit',
          }}
        />

        <button
          type="button"
          onClick={() => canSubmit && onSubmit(trimmed)}
          disabled={!canSubmit}
          aria-label={t('save')}
          data-composer-submit
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white transition-transform active:scale-95 disabled:opacity-40"
          style={{ background: 'var(--accent)' }}
        >
          {saving ? (
            <span
              className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
              aria-hidden="true"
            />
          ) : (
            <svg
              aria-hidden="true"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={ICON_STROKE_WIDTH + 0.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {mode === 'edit' ? <path d="m5 12 5 5L20 7" /> : <path d="M12 19V5M5 12l7-7 7 7" />}
            </svg>
          )}
        </button>
      </div>

      {/* 数えるのは上限が近いときだけ。3/2000 を常に出しても読む理由がない。 */}
      {text.length > MAX_SNIPPET_TEXT_LENGTH * 0.8 ? (
        <span
          className="px-1 text-right text-[11px]"
          style={{ color: tooLong ? 'var(--ob-jar-warm)' : 'var(--date-color)' }}
        >
          {`${text.length} / ${MAX_SNIPPET_TEXT_LENGTH}`}
        </span>
      ) : null}
    </div>
  );
}
