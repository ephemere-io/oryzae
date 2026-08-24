'use client';

import {
  MAX_OCR_IMAGE_BYTES,
  MAX_SNIPPET_TEXT_LENGTH,
  OCR_ALLOWED_IMAGE_TYPES,
} from '@oryzae/shared';
import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useOcrSnippetText } from '@/features/shared/board/hooks/use-ocr-snippet-text';
import type { ApiClient } from '@/lib/api';
import { useEscapeKey } from '@/lib/use-escape-key';

interface SnippetDialogProps {
  open: boolean;
  api: ApiClient | null;
  initialText?: string;
  onSubmit: (text: string) => void;
  onClose: () => void;
}

/** 'text' = 直接書く。'image' = 画像を読み取って（OCR）本文にする。 */
type Source = 'text' | 'image';

/** 画像タブの状態。'reading' の間は読み取り中の表示を出し、操作を止める。 */
type OcrStatus = 'idle' | 'reading' | 'empty' | 'failed';

function isAllowedImage(file: File): boolean {
  return OCR_ALLOWED_IMAGE_TYPES.some((allowed) => allowed === file.type);
}

export function SnippetDialog({
  open,
  api,
  initialText = '',
  onSubmit,
  onClose,
}: SnippetDialogProps) {
  const t = useTranslations('board.snippet_dialog');
  const ocr = useOcrSnippetText(api);

  const [source, setSource] = useState<Source>('text');
  const [text, setText] = useState(initialText);
  const [fromImage, setFromImage] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [ocrStatus, setOcrStatus] = useState<OcrStatus>('idle');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // preview の objectURL は「差し替え時」と「閉じた時」に必ず revoke する。
  // state を直接見に行くと effect の依存で取りこぼすので ref にも持つ。
  const previewRef = useRef<string | null>(null);

  const releasePreview = useCallback(() => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = null;
  }, []);

  useEffect(() => {
    if (!open) {
      releasePreview();
      setPreview(null);
      setImageFile(null);
      setOcrStatus('idle');
      setFromImage(false);
      setSource('text');
      return;
    }
    setText(initialText);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [open, initialText, releasePreview]);

  // アンマウント時の取りこぼし防止（open のまま破棄されるケース）。
  useEffect(() => releasePreview, [releasePreview]);

  // 読み取り中は閉じさせない（PhotoDialog がアップロード中に閉じさせないのと同じ理由。
  // 閉じた後に読み取り結果が届くと、次に開いたダイアログへ横入りしてしまう）。
  const busy = ocrStatus === 'reading';
  useEscapeKey(open && !busy, onClose);

  if (!open) return null;

  // 既存スニペットの編集では画像タブを出さない。差し替えではなく本文を直す操作なので、
  // 読み取り結果で丸ごと上書きできてしまうと事故になる。
  const mode = initialText ? 'edit' : 'create';
  const canUseImage = mode === 'create';
  const trimmed = text.trim();
  const empty = trimmed.length === 0;
  const tooLong = text.length > MAX_SNIPPET_TEXT_LENGTH;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (empty || tooLong || busy) return;
    onSubmit(trimmed);
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    releasePreview();
    if (!isAllowedImage(file) || file.size > MAX_OCR_IMAGE_BYTES) {
      // 送る前に弾く。サーバーも同じ条件で 400 を返すが、往復を待たせない。
      setImageFile(null);
      setPreview(null);
      setOcrStatus('failed');
      return;
    }
    const url = URL.createObjectURL(file);
    previewRef.current = url;
    setPreview(url);
    setImageFile(file);
    setOcrStatus('idle');
  };

  const handleRead = async () => {
    if (!imageFile || busy) return;
    setOcrStatus('reading');
    const result = await ocr(imageFile);
    if (result.status === 'ok') {
      setText(result.text);
      setFromImage(true);
      setOcrStatus('idle');
      // 読み取った本文はほぼ必ず手直しが要る（50文字制限）。編集できる場所へ送る。
      setSource('text');
      setTimeout(() => inputRef.current?.focus(), 50);
      return;
    }
    setOcrStatus(result.status === 'empty' ? 'empty' : 'failed');
  };

  const tabStyle = (active: boolean) =>
    active
      ? { color: 'var(--fg)', borderColor: 'var(--accent)' }
      : { color: 'var(--date-color)', borderColor: 'transparent' };

  return (
    <div
      role="dialog"
      aria-label={t('aria_label')}
      className="fixed inset-0 z-[2000] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
      {...verifyAttrs({
        unit: 'SnippetDialog',
        mode,
        source,
        empty,
        tooLong,
        ocrStatus,
        fromImage,
      })}
      onClick={() => {
        if (!busy) onClose();
      }}
      // Escape の本体は useEscapeKey（window 側）。ここはフォーカスが overlay 自身に
      // ある場合の保険で、二重に呼ばれても onClose は冪等なので害はない。
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !busy) onClose();
      }}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="w-[90%] max-w-[400px] rounded-xl shadow-lg"
        style={{ backgroundColor: 'var(--bg)', padding: '28px 32px' }}
      >
        <h3 className="mb-4 text-sm font-semibold" style={{ color: 'var(--fg)' }}>
          {mode === 'edit' ? t('heading_edit') : t('heading_create')}
        </h3>

        {canUseImage && (
          <div
            role="tablist"
            aria-label={t('source_aria')}
            className="mb-4 flex items-center gap-4 border-b"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <button
              type="button"
              role="tab"
              aria-selected={source === 'text'}
              data-verify-source-tab="text"
              onClick={() => setSource('text')}
              className="-mb-px border-b-2 pb-2 text-xs transition-colors"
              style={tabStyle(source === 'text')}
            >
              {t('tab_text')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={source === 'image'}
              data-verify-source-tab="image"
              onClick={() => setSource('image')}
              className="-mb-px border-b-2 pb-2 text-xs transition-colors"
              style={tabStyle(source === 'image')}
            >
              {t('tab_image')}
            </button>
          </div>
        )}

        {source === 'image' ? (
          <div className="mb-4 text-center">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="relative mx-auto mb-3 flex w-full items-center justify-center rounded-lg border-2 border-dashed"
              style={{
                aspectRatio: '4 / 3',
                borderColor: 'var(--border-subtle)',
                backgroundColor: 'var(--toolbar-hover)',
                overflow: 'hidden',
              }}
            >
              {preview ? (
                <img
                  src={preview}
                  alt={t('preview_alt')}
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              ) : (
                <span className="px-4 text-xs" style={{ color: 'var(--date-color)' }}>
                  {t('click_to_select_image')}
                </span>
              )}
              {busy && (
                <div
                  role="status"
                  aria-label={t('reading_aria')}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-2"
                  style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
                >
                  <span className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span className="text-xs text-white">{t('reading')}</span>
                </div>
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept={OCR_ALLOWED_IMAGE_TYPES.join(',')}
              aria-label={t('click_to_select_image')}
              onChange={handleFileChange}
              className="hidden"
            />

            {ocrStatus === 'empty' && (
              <p className="mb-2 text-[11px]" style={{ color: 'var(--date-color)' }}>
                {t('ocr_empty')}
              </p>
            )}
            {ocrStatus === 'failed' && (
              <p className="mb-2 text-[11px]" style={{ color: 'var(--accent)' }}>
                {t('ocr_failed', { maxMb: MAX_OCR_IMAGE_BYTES / 1024 / 1024 })}
              </p>
            )}

            <button
              type="button"
              onClick={handleRead}
              disabled={!imageFile || busy}
              className="w-full rounded-md border px-4 py-2 text-xs text-white disabled:opacity-40"
              style={{ backgroundColor: 'var(--accent)', borderColor: 'var(--accent)' }}
            >
              {busy ? t('reading') : t('read_image')}
            </button>
          </div>
        ) : (
          <>
            <textarea
              ref={inputRef}
              value={text}
              // fromImage は編集しても倒さない。読み取り結果はほぼ必ず手直しが要るので、
              // 1文字打った途端に「画像から読み取った下書き」という説明が消えると、
              // 何を整えている最中なのか分からなくなる。
              onChange={(e) => setText(e.target.value)}
              rows={3}
              aria-label={t('placeholder')}
              placeholder={t('placeholder')}
              className="mb-2 w-full resize-none rounded-md border px-3 py-2.5 text-sm outline-none"
              style={{
                height: 80,
                backgroundColor: 'var(--bg)',
                borderColor: tooLong ? 'var(--accent)' : 'var(--border-subtle)',
                color: 'var(--fg)',
              }}
            />
            <div className="mb-4 flex items-start justify-between gap-3">
              <p className="text-left text-[11px]" style={{ color: 'var(--date-color)' }}>
                {tooLong
                  ? t('too_long', { max: MAX_SNIPPET_TEXT_LENGTH })
                  : fromImage
                    ? t('ocr_note', { max: MAX_SNIPPET_TEXT_LENGTH })
                    : ''}
              </p>
              <span
                className="shrink-0 text-[11px]"
                style={{ color: tooLong ? 'var(--accent)' : 'var(--date-color)' }}
              >
                {text.length}/{MAX_SNIPPET_TEXT_LENGTH}
              </span>
            </div>
          </>
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
            disabled={empty || tooLong || busy}
            className="rounded-md border px-4 py-2 text-xs text-white disabled:opacity-40"
            style={{ backgroundColor: 'var(--accent)', borderColor: 'var(--accent)' }}
          >
            {mode === 'edit' ? t('update') : t('create')}
          </button>
        </div>
      </form>
    </div>
  );
}
