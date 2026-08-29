'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { useCallback, useRef, useState } from 'react';
import { useEscapeKey } from '@/lib/use-escape-key';

interface PhotoDialogProps {
  open: boolean;
  onSubmit: (file: File, caption: string, imageWidth: number, imageHeight: number) => Promise<void>;
  onClose: () => void;
}

interface ResizeResult {
  blob: Blob;
  width: number;
  height: number;
}

function resizeImage(file: File, maxWidth: number, quality: number): Promise<ResizeResult> {
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => resolve({ blob: blob ?? file, width, height }),
        'image/jpeg',
        quality,
      );
    };
    img.src = objectUrl;
  });
}

function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image'));
    };
    img.src = objectUrl;
  });
}

export function PhotoDialog({ open, onSubmit, onClose }: PhotoDialogProps) {
  const t = useTranslations('board.photo_dialog');
  const [caption, setCaption] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // 閉じる処理は hook より前に定義する（useEscapeKey を early return の前に呼ぶため）。
  // このダイアログは閉じても state を捨てないので、後始末（objectURL の revoke と
  // 入力のリセット）をここで必ず通す。preview は関数形式で読み、依存に入れずに済ませる。
  const handleClose = useCallback(() => {
    if (uploading) return;
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setCaption('');
    setSelectedFile(null);
    setAspectRatio(null);
    onClose();
  }, [uploading, onClose]);

  useEscapeKey(open, handleClose);

  if (!open) return null;

  const canSubmit = Boolean(selectedFile) && !uploading;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (preview) URL.revokeObjectURL(preview);
    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));
    setAspectRatio(null);
    try {
      const { width, height } = await readImageDimensions(file);
      if (width > 0 && height > 0) {
        setAspectRatio(width / height);
      }
    } catch {
      setAspectRatio(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || uploading) return;

    setUploading(true);
    try {
      const { blob, width, height } = await resizeImage(selectedFile, 800, 0.7);
      const resizedFile = new File([blob], selectedFile.name, { type: 'image/jpeg' });
      await onSubmit(resizedFile, caption.trim(), width, height);
      if (preview) URL.revokeObjectURL(preview);
      setCaption('');
      setPreview(null);
      setSelectedFile(null);
      setAspectRatio(null);
      onClose();
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      {...verifyAttrs({
        unit: 'PhotoDialog',
        uploading,
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
            backgroundColor: 'var(--toolbar-hover)',
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
            className="rounded-md border px-4 py-2 text-xs transition-colors hover:bg-[var(--toolbar-hover)] disabled:opacity-40"
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
