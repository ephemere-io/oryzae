'use client';

import { useRef, useState } from 'react';

interface PhotoDialogProps {
  open: boolean;
  onSubmit: (file: File, caption: string) => void;
  onClose: () => void;
}

function resizeImage(file: File, maxWidth: number, quality: number): Promise<Blob> {
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
      canvas.toBlob((blob) => resolve(blob ?? file), 'image/jpeg', quality);
    };
    img.src = objectUrl;
  });
}

export function PhotoDialog({ open, onSubmit, onClose }: PhotoDialogProps) {
  const [caption, setCaption] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (preview) URL.revokeObjectURL(preview);
    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    const resized = await resizeImage(selectedFile, 800, 0.7);
    const resizedFile = new File([resized], selectedFile.name, { type: 'image/jpeg' });
    onSubmit(resizedFile, caption.trim());
    if (preview) URL.revokeObjectURL(preview);
    setCaption('');
    setPreview(null);
    setSelectedFile(null);
    onClose();
  };

  const handleClose = () => {
    if (preview) URL.revokeObjectURL(preview);
    setCaption('');
    setPreview(null);
    setSelectedFile(null);
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
          className="mb-4 flex w-full items-center justify-center rounded-lg border-2 border-dashed"
          style={{
            aspectRatio: '1',
            borderColor: 'var(--border-subtle)',
            backgroundColor: 'var(--toolbar-hover)',
            overflow: 'hidden',
          }}
        >
          {preview ? (
            <img
              src={preview}
              alt="Preview"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <span className="text-xs" style={{ color: 'var(--date-color)' }}>
              クリックして写真を選択
            </span>
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
          placeholder="キャプション（20文字以内）"
          className="mb-4 w-full rounded-md border px-3 py-2.5 text-left text-sm outline-none"
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
            className="rounded-md border px-4 py-2 text-xs"
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
            disabled={!selectedFile}
            className="rounded-md border px-4 py-2 text-xs text-white disabled:opacity-40"
            style={{ backgroundColor: 'var(--accent)', borderColor: 'var(--accent)' }}
          >
            追加
          </button>
        </div>
      </form>
    </div>
  );
}
