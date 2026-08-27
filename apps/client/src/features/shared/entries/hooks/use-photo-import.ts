'use client';

import { MAX_ENTRY_PHOTO_BYTES } from '@oryzae/shared';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AttachedPhoto, PhotoImportState } from '@/features/shared/entries/types';
import type { ApiClient } from '@/lib/api';
import { resizeImageForUpload } from '@/lib/resize-image';

/**
 * 写真の取り込みフロー（端末非依存）。PC のモーダルと SP のシートが同じ状態を使う。
 *
 * 流れ: 写真を選ぶ → プレビュー → 「文字として読み込む」か「写真として貼る」を選ぶ
 *   - 文字: 起こした結果をユーザーに見せ、本文に入れるか捨てるかを選ばせる。
 *     OCR は必ず外すので、確認なしに本文を書き換えない。
 *   - 写真: Storage に上げて公開 URL を親に返す（親が mediaUrls として保存する）。
 */
interface UsePhotoImportParams {
  api: ApiClient | null;
  /** 「写真として貼る」で Storage に上がった写真。保存するのは path、表示は signedUrl。 */
  onAttach: (photo: AttachedPhoto) => void;
  /** 「本文に入れる」で確定した文字起こし結果。 */
  onInsertText: (text: string) => void;
}

const INITIAL: PhotoImportState = {
  open: false,
  fileName: '',
  previewUrl: null,
  status: 'idle',
  error: '',
  transcript: null,
};

export function usePhotoImport({ api, onAttach, onInsertText }: UsePhotoImportParams) {
  const t = useTranslations('photo');
  const locale = useLocale();
  const [state, setState] = useState<PhotoImportState>(INITIAL);

  // リサイズ済みファイルは state に入れない（描画に関係しないため）。
  const fileRef = useRef<File | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const revokePreview = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  }, []);

  // アンマウント時に object URL を取り逃さない。
  useEffect(() => revokePreview, [revokePreview]);

  const close = useCallback(() => {
    revokePreview();
    fileRef.current = null;
    setState(INITIAL);
  }, [revokePreview]);

  /** ファイル選択直後。ここでリサイズまで済ませる（以降は軽い JPEG を扱う）。 */
  const selectFile = useCallback(
    async (file: File) => {
      revokePreview();
      fileRef.current = null;
      setState({ ...INITIAL, open: true, fileName: file.name, status: 'uploading' });

      try {
        const resized = await resizeImageForUpload(file);
        if (resized.size > MAX_ENTRY_PHOTO_BYTES) {
          setState((s) => ({ ...s, status: 'idle', error: t('error_too_large') }));
          return;
        }
        fileRef.current = resized;
        const url = URL.createObjectURL(resized);
        previewUrlRef.current = url;
        setState((s) => ({ ...s, previewUrl: url, status: 'idle' }));
      } catch {
        setState((s) => ({ ...s, status: 'idle', error: t('error_decode') }));
      }
    },
    [revokePreview, t],
  );

  const transcribe = useCallback(async () => {
    const file = fileRef.current;
    if (!api || !file) return;
    setState((s) => ({ ...s, status: 'transcribing', error: '' }));

    const form = new FormData();
    form.append('file', file);
    form.append('language', locale);

    try {
      const res = await api.fetch('/api/v1/entries/photos/transcribe', {
        method: 'POST',
        body: form,
      });
      if (!res.ok) {
        const message = res.status === 429 ? t('error_rate_limited') : t('error_transcribe');
        setState((s) => ({ ...s, status: 'idle', error: message }));
        return;
      }
      const data: unknown = await res.json();
      const text =
        typeof data === 'object' && data !== null && 'text' in data && typeof data.text === 'string'
          ? data.text
          : '';
      setState((s) => ({ ...s, status: 'idle', transcript: text }));
    } catch {
      setState((s) => ({ ...s, status: 'idle', error: t('error_transcribe') }));
    }
  }, [api, locale, t]);

  const attach = useCallback(async () => {
    const file = fileRef.current;
    if (!api || !file) return;
    setState((s) => ({ ...s, status: 'uploading', error: '' }));

    const form = new FormData();
    form.append('file', file);

    try {
      const res = await api.fetch('/api/v1/entries/photos', { method: 'POST', body: form });
      if (!res.ok) {
        setState((s) => ({ ...s, status: 'idle', error: t('error_upload') }));
        return;
      }
      // storagePath がエントリに保存する値、signedUrl は表示用（1時間で失効）。
      // バケットが private なので公開 URL は存在しない（00023 / #504）。
      const data: unknown = await res.json();
      if (
        typeof data !== 'object' ||
        data === null ||
        !('storagePath' in data) ||
        typeof data.storagePath !== 'string' ||
        !('signedUrl' in data) ||
        typeof data.signedUrl !== 'string'
      ) {
        setState((s) => ({ ...s, status: 'idle', error: t('error_upload') }));
        return;
      }
      onAttach({ storagePath: data.storagePath, signedUrl: data.signedUrl });
      close();
    } catch {
      setState((s) => ({ ...s, status: 'idle', error: t('error_upload') }));
    }
  }, [api, close, onAttach, t]);

  /** 起こした文字を本文に入れて閉じる。 */
  const insertTranscript = useCallback(() => {
    const text = state.transcript;
    if (!text) return;
    onInsertText(text);
    close();
  }, [state.transcript, onInsertText, close]);

  /** 起こした文字だけを捨てて、プレビューに戻る（写真として貼り直せる）。 */
  const discardTranscript = useCallback(() => {
    setState((s) => ({ ...s, transcript: null }));
  }, []);

  return { state, selectFile, transcribe, attach, insertTranscript, discardTranscript, close };
}
