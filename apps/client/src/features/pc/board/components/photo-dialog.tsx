'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { readImageDimensions, resizeImage } from '@/lib/image';
import { useEscapeKey } from '@/lib/use-escape-key';

interface PhotoDialogProps {
  open: boolean;
  /** 貼り付け・ドロップで入ってきた画像。開いた時点で選択済みとして扱う。 */
  initialFile?: File | null;
  onSubmit: (file: File, caption: string, imageWidth: number, imageHeight: number) => Promise<void>;
  onClose: () => void;
}

/**
 * 送信前の縮小。
 *
 * 800px / 品質 0.7 まで落としていたので、盤面で拡大すると目に見えて荒れていた。
 * ライトボックスは画面の 80% まで開くので、Retina だと 3000px 近く要る。
 * 上限を 2400px・品質 0.9 に上げ、元がそれより小さければ**一切触らない**
 * （小さい画像をわざわざ JPEG に焼き直して劣化させない）。
 */
const MAX_UPLOAD_WIDTH = 2400;
const JPEG_QUALITY = 0.9;

export function PhotoDialog({ open, initialFile, onSubmit, onClose }: PhotoDialogProps) {
  const t = useTranslations('board.photo_dialog');
  const [caption, setCaption] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  /** 'unsupported' = ブラウザがデコードできない画像 / 'failed' = 変換・送信の失敗。 */
  const [error, setError] = useState<'unsupported' | 'failed' | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  /** 表示中の objectURL。state だけだと非同期中の取りこぼしが出るので ref でも持つ。 */
  const previewRef = useRef<string | null>(null);
  /**
   * 選択の世代。画像の判定は非同期なので、判定中に選び直されると古い結果が
   * 新しい選択を壊す（HEIC を選ぶ → 案内どおり JPEG に選び直す → 古い失敗が
   * 後から届いて新しいプレビューを消す）。await の後はこれを見て、追い越されて
   * いたら何もしない。
   */
  const selectionRef = useRef(0);

  /** objectURL の差し替えを1か所に集約する（前の URL を必ず revoke する）。 */
  const setPreviewUrl = useCallback((url: string | null) => {
    if (previewRef.current && previewRef.current !== url) {
      URL.revokeObjectURL(previewRef.current);
    }
    previewRef.current = url;
    setPreview(url);
  }, []);

  // 閉じる処理は hook より前に定義する（useEscapeKey を early return の前に呼ぶため）。
  // このダイアログは閉じても state を捨てないので、後始末をここで必ず通す。
  const handleClose = useCallback(() => {
    if (uploading) return;
    selectionRef.current++;
    setPreviewUrl(null);
    setCaption('');
    setSelectedFile(null);
    setAspectRatio(null);
    setError(null);
    onClose();
  }, [uploading, onClose, setPreviewUrl]);

  useEscapeKey(open, handleClose);

  // アンマウント時の取りこぼし防止。handleClose はアップロード中に早期 return するので、
  // 送信中に親ごと破棄されると objectURL が誰にも revoke されずに残る
  // （SnippetDialog は同じ理由で releasePreview を返している）。
  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
    };
  }, []);

  const acceptFile = useCallback(
    async (file: File | null | undefined) => {
      if (!file) return;

      const generation = ++selectionRef.current;
      setPreviewUrl(URL.createObjectURL(file));
      setError(null);
      setSelectedFile(file);
      setAspectRatio(null);
      try {
        const { width, height } = await readImageDimensions(file);
        // 判定中に選び直されていたら、こちらの結果はもう用済み。
        if (generation !== selectionRef.current) return;
        if (width > 0 && height > 0) {
          setAspectRatio(width / height);
        }
      } catch {
        // ここで落ちる＝ブラウザがこの画像をデコードできない。以前は握り潰していたので
        // 「追加」を押せてしまい、リサイズで固まっていた。選んだ時点で伝えて止める。
        // 追い越されていたら触らない（新しい選択を壊さない。URL は setPreviewUrl が
        // 差し替え時に revoke 済み）。
        if (generation !== selectionRef.current) return;
        setPreviewUrl(null);
        setSelectedFile(null);
        setAspectRatio(null);
        setError('unsupported');
      }
    },
    [setPreviewUrl],
  );

  // 貼り付け・ドロップで渡された画像を、選択されたものとして取り込む。
  // 同じ File で何度も走らないよう、取り込み済みのものを覚えておく。
  const takenRef = useRef<File | null>(null);
  useEffect(() => {
    if (!open) {
      takenRef.current = null;
      return;
    }
    if (!initialFile || takenRef.current === initialFile) return;
    takenRef.current = initialFile;
    void acceptFile(initialFile);
  }, [open, initialFile, acceptFile]);

  if (!open) return null;

  const canSubmit = Boolean(selectedFile) && !uploading;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // 同じファイルを選び直しても change が発火するよう、掴んだ直後に value を空にする。
    // これが無いと、開けない画像で弾いた後に「JPEG に変換して同じ名前で選び直す」が
    // 効かず（value が変わらないのでイベントが出ない）、エラー表示のまま詰む。
    e.target.value = '';
    void acceptFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || uploading) return;

    setUploading(true);
    setError(null);
    try {
      const { blob, width, height } = await resizeImage(
        selectedFile,
        MAX_UPLOAD_WIDTH,
        JPEG_QUALITY,
      );
      const resizedFile = new File([blob], selectedFile.name, { type: 'image/jpeg' });
      await onSubmit(resizedFile, caption.trim(), width, height);
      selectionRef.current++;
      setPreviewUrl(null);
      setCaption('');
      setSelectedFile(null);
      setAspectRatio(null);
      onClose();
    } catch {
      // リサイズ・アップロードの失敗。以前は握り潰す先すら無く、resizeImage が
      // 解決しないまま「アップロード中…」で固まっていた。結果を画面に返す。
      setError('failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      {...verifyAttrs({
        unit: 'PhotoDialog',
        uploading,
        error: error ?? 'none',
        hasPreview: Boolean(preview),
        canSubmit,
      })}
      role="dialog"
      aria-label={t('aria_label')}
      className="fixed inset-0 z-[2000] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
      onClick={handleClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') handleClose();
      }}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="w-[90%] max-w-[400px] rounded-xl text-center shadow-lg"
        style={{ backgroundColor: 'var(--bg)', padding: '28px 32px' }}
      >
        <h3 className="mb-4 text-sm font-semibold" style={{ color: 'var(--fg)' }}>
          {t('heading')}
        </h3>

        {/* Preview / File picker */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="relative mx-auto mb-4 flex items-center justify-center rounded-lg border-2 border-dashed"
          style={{
            aspectRatio: preview && aspectRatio ? String(aspectRatio) : '1',
            width: preview && aspectRatio ? `min(100%, calc(50vh * ${aspectRatio}))` : '100%',
            maxHeight: '50vh',
            borderColor: 'var(--border-subtle)',
            backgroundColor: 'var(--hover-wash)',
            overflow: 'hidden',
          }}
        >
          {preview ? (
            <img
              src={preview}
              alt="Preview"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          ) : (
            <span className="text-xs" style={{ color: 'var(--date-color)' }}>
              {t('click_to_select')}
            </span>
          )}
          {uploading && (
            <div
              role="status"
              aria-label={t('uploading_aria')}
              className="absolute inset-0 flex flex-col items-center justify-center gap-2"
              style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
            >
              <span className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
              <span className="text-xs text-white">{t('uploading')}</span>
            </div>
          )}
        </button>
        {error && (
          <p className="mb-3 text-xs leading-relaxed" style={{ color: 'var(--accent)' }}>
            {error === 'unsupported' ? t('unsupported') : t('upload_failed')}
          </p>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          aria-label={t('click_to_select')}
          onChange={handleFileChange}
          className="hidden"
        />

        <input
          type="text"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          maxLength={20}
          disabled={uploading}
          aria-label={t('caption_placeholder')}
          placeholder={t('caption_placeholder')}
          className="mb-4 w-full rounded-md border px-3 py-2.5 text-left text-sm outline-none disabled:opacity-50"
          style={{
            backgroundColor: 'var(--bg)',
            borderColor: 'var(--border-subtle)',
            color: 'var(--fg)',
          }}
        />
        <div className="flex justify-center gap-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={uploading}
            className="rounded-md border px-4 py-2 text-xs transition-colors hover:bg-[var(--hover-wash)] disabled:opacity-40"
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
            disabled={!selectedFile || uploading}
            className="rounded-md border px-4 py-2 text-xs text-white transition-opacity hover:opacity-85 disabled:opacity-40 disabled:hover:opacity-40"
            style={{ backgroundColor: 'var(--accent)', borderColor: 'var(--accent)' }}
          >
            {uploading ? t('uploading_button') : t('submit')}
          </button>
        </div>
      </form>
    </div>
  );
}
