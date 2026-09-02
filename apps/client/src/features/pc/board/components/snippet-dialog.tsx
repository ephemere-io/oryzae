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
  /** 既存スニペットを編集するときだけ渡す。作成なら未指定。モード判定はこれで行う。 */
  snippetId?: string;
  initialText?: string;
  /** 開いた直後にどちらのタブを出すか。ツールバーの「画像から読み取る」は 'image'。 */
  initialSource?: Source;
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
  snippetId,
  initialText = '',
  initialSource = 'text',
  onSubmit,
  onClose,
}: SnippetDialogProps) {
  const t = useTranslations('board.snippet_dialog');
  const ocr = useOcrSnippetText(api);

  const [source, setSource] = useState<Source>(initialSource);
  const [text, setText] = useState(initialText);
  const [fromImage, setFromImage] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [ocrStatus, setOcrStatus] = useState<OcrStatus>('idle');
  /** ドラッグ中の枠のハイライト。落とせることを見た目で返す。 */
  const [dragging, setDragging] = useState(false);
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
      setDragging(false);
      return;
    }
    // 開くたびに入口へ戻す。ツールバーの「画像から読み取る」から来たときは
    // 画像タブが開いた状態で始まる（1手で読み取りに着く）。
    setSource(initialSource);
    setText(initialText);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [open, initialText, initialSource, releasePreview]);

  // アンマウント時の取りこぼし防止（open のまま破棄されるケース）。
  useEffect(() => releasePreview, [releasePreview]);

  // 読み取り中は閉じさせない（PhotoDialog がアップロード中に閉じさせないのと同じ理由。
  // 閉じた後に読み取り結果が届くと、次に開いたダイアログへ横入りしてしまう）。
  const busy = ocrStatus === 'reading';
  useEscapeKey(open && !busy, onClose);

  if (!open) return null;

  // 既存スニペットの編集では画像タブを出さない。差し替えではなく本文を直す操作なので、
  // 読み取り結果で丸ごと上書きできてしまうと事故になる。
  //
  // 判定は snippetId の有無で行う。本文（initialText）の truthiness で見ると、
  // 送信側（board-view の updateSnippet/createSnippet の分岐）と基準がズレる。
  // 本文が空の既存スニペットを開いたときに create 扱いになり、画像タブから OCR で
  // 全文を差し替えられるのに送信は update に落ちる——このコメントが防ごうとしている
  // 事故そのものが起きる。今はサーバーが空本文を弾いているので実際には出ないが、
  // 「同じ判断は同じ基準で」を守る。
  const mode = snippetId ? 'edit' : 'create';
  const canUseImage = mode === 'create';
  const trimmed = text.trim();
  const empty = trimmed.length === 0;
  const tooLong = text.length > MAX_SNIPPET_TEXT_LENGTH;
  // 上限は 2000 文字あるので、普段は文字数を出さない。"3/2000" は誰も見ていないのに
  // 目に入り続けるだけで、上限が迫っていることを伝える役に立っていない。
  const showCounter = text.length > MAX_SNIPPET_TEXT_LENGTH * 0.8;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (empty || tooLong || busy) return;
    onSubmit(trimmed);
    onClose();
  };

  /** 画像1枚に対して読み取りを走らせ、結果を編集できる場所へ載せる。 */
  const runOcr = async (file: File) => {
    setOcrStatus('reading');
    const result = await ocr(file);
    if (result.status === 'ok') {
      setText(result.text);
      setFromImage(true);
      setOcrStatus('idle');
      // 読み取り結果はそのまま貼らず、必ず編集できる場所へ送る。誤読は残るし、
      // 要るのは写した文字そのものではなく、自分の言葉に直したものであることが多い。
      setSource('text');
      setTimeout(() => inputRef.current?.focus(), 50);
      return;
    }
    setOcrStatus(result.status === 'empty' ? 'empty' : 'failed');
  };

  /**
   * ファイル選択・ドロップの共通入口。**選んだ時点で読み取りまで進める**。
   * 以前は選択後に「文字を読み取る」を押させていたが、画像を選ぶ意図＝読み取りたい、
   * なので一手増やしているだけだった。失敗したときだけ「もう一度」を出す。
   */
  const acceptFile = (file: File | undefined) => {
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
    void runOcr(file);
  };

  const handleRead = () => {
    if (!imageFile || busy) return;
    void runOcr(imageFile);
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
        // 上限が 2000 文字あるのに 400px 幅・3行の窓では書けない。読み取り結果を
        // その場で直す前提の場所なので、書き物として成立する大きさにする。
        className="flex w-[90%] max-w-[640px] flex-col rounded-xl shadow-lg"
        style={{ backgroundColor: 'var(--bg)', padding: '28px 32px', maxHeight: '80vh' }}
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
              className="-mb-px border-b-2 pb-2 text-xs transition-colors hover:text-[var(--fg)]"
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
              className="-mb-px border-b-2 pb-2 text-xs transition-colors hover:text-[var(--fg)]"
              style={tabStyle(source === 'image')}
            >
              {t('tab_image')}
            </button>
          </div>
        )}

        {source === 'image' ? (
          <div className="mb-4 text-center">
            {/* 読み取りは完全ではない。結果を見てから「あれ、違う」と気づくより、
                選ぶ前に分かっているほうが、確かめる構えで受け取れる。 */}
            <p
              className="mb-3 text-left text-[11px] leading-relaxed"
              style={{ color: 'var(--date-color)' }}
            >
              {t('ocr_caveat')}
            </p>
            {/* 破線の枠は「ここに落とせる」という見た目なので、実際に落とせるようにする。
                見た目だけドロップゾーンで受け付けないのが一番の混乱のもとだった。 */}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                if (!busy) setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                if (!busy) acceptFile(e.dataTransfer.files?.[0]);
              }}
              disabled={busy}
              aria-label={t('click_to_select_image')}
              className="relative mx-auto mb-3 flex w-full items-center justify-center rounded-lg border-2 border-dashed transition-colors"
              style={{
                aspectRatio: '4 / 3',
                borderColor: dragging ? 'var(--accent)' : 'var(--border-subtle)',
                backgroundColor: dragging ? 'var(--accent-light)' : 'var(--toolbar-hover)',
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
                <span
                  className="px-4 text-xs leading-relaxed"
                  style={{ color: 'var(--date-color)' }}
                >
                  {t('drop_or_click_image')}
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
              // 同じファイルを選び直しても change が発火するよう value を空に戻す。
              // 無いと、対応外で弾いた後に同じ名前で選び直しても何も起きない。
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                acceptFile(file);
              }}
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

            {/* 選んだら自動で読み取るので、通常はこのボタンを押す必要はない。
                読み取れなかったときの「もう一度」だけ出す。 */}
            {imageFile && !busy && ocrStatus !== 'idle' && (
              <button
                type="button"
                onClick={handleRead}
                className="w-full rounded-md border px-4 py-2 text-xs text-white transition-opacity hover:opacity-85"
                style={{ backgroundColor: 'var(--accent)', borderColor: 'var(--accent)' }}
              >
                {t('read_again')}
              </button>
            )}
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
              rows={12}
              aria-label={t('placeholder')}
              placeholder={t('placeholder')}
              className="board-scroll mb-2 w-full resize-y rounded-md border px-3 py-2.5 text-sm leading-relaxed outline-none"
              style={{
                minHeight: 260,
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
                    ? t('ocr_note')
                    : ''}
              </p>
              {showCounter && (
                <span
                  className="shrink-0 text-[11px]"
                  style={{ color: tooLong ? 'var(--accent)' : 'var(--date-color)' }}
                >
                  {text.length}/{MAX_SNIPPET_TEXT_LENGTH}
                </span>
              )}
            </div>
          </>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            // 読み取り中は閉じさせない。他の3経路（Escape・overlay クリック・overlay の
            // onKeyDown）は busy を見ているのに、ここだけ素通りだった。閉じた後に
            // 読み取り結果が届くと、リセット後の state に着弾して次に開いたダイアログへ
            // 混入する。PhotoDialog のキャンセルが disabled={uploading} なのと揃える。
            disabled={busy}
            className="rounded-md border px-4 py-2 text-xs transition-colors hover:bg-[var(--toolbar-hover)] disabled:opacity-40 disabled:hover:bg-transparent"
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
            className="rounded-md border px-4 py-2 text-xs text-white transition-opacity hover:opacity-85 disabled:opacity-40 disabled:hover:opacity-40"
            style={{ backgroundColor: 'var(--accent)', borderColor: 'var(--accent)' }}
          >
            {mode === 'edit' ? t('update') : t('create')}
          </button>
        </div>
      </form>
    </div>
  );
}
