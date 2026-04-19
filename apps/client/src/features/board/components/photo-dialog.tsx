'use client';

import { useRef, useState } from 'react';

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
  const [caption, setCaption] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

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

  const handleClose = () => {
    if (uploading) return;
    if (preview) URL.revokeObjectURL(preview);
    setCaption('');
    setPreview(null);
    setSelectedFile(null);
    setAspectRatio(null);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-label="Photo upload dialog"
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
          写真を追加
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
              クリックして写真を選択
            </span>
          )}
          {uploading && (
            <div
              role="status"
              aria-label="アップロード中"
              className="absolute inset-0 flex flex-col items-center justify-center gap-2"
              style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
            >
              <span className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
              <span className="text-xs text-white">アップロード中…</span>
            </div>
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />

        <input
          type="text"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          maxLength={20}
          disabled={uploading}
          placeholder="キャプション（20文字以内）"
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
            className="rounded-md border px-4 py-2 text-xs disabled:opacity-40"
            style={{
              borderColor: 'var(--border-subtle)',
              color: 'var(--fg)',
              backgroundColor: 'var(--bg)',
            }}
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={!selectedFile || uploading}
            className="rounded-md border px-4 py-2 text-xs text-white disabled:opacity-40"
            style={{ backgroundColor: 'var(--accent)', borderColor: 'var(--accent)' }}
          >
            {uploading ? 'アップロード中…' : '追加'}
          </button>
        </div>
      </form>
    </div>
  );
}
