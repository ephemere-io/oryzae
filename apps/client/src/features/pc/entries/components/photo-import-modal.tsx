'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { ElapsedSeconds } from '@/features/pc/entries/components/elapsed-seconds';
import type { PhotoImportState } from '@/features/shared/entries/types';

interface PhotoImportModalProps {
  state: PhotoImportState;
  onTranscribe: () => void;
  onAttach: () => void;
  onInsertTranscript: () => void;
  onDiscardTranscript: () => void;
  onClose: () => void;
}

/**
 * 取り込んだ写真を「文字として読み込む」か「写真として貼る」か選ばせるモーダル（PC）。
 *
 * 状態は usePhotoImport が持ち、ここは props を映すだけの純表示にしてある
 * （孤立検証を成立させるため）。文字起こし結果は必ず一度ユーザーに見せてから
 * 本文へ入れる — OCR は必ず外すので、勝手に本文を書き換えないという設計判断。
 */
export function PhotoImportModal({
  state,
  onTranscribe,
  onAttach,
  onInsertTranscript,
  onDiscardTranscript,
  onClose,
}: PhotoImportModalProps) {
  const t = useTranslations('photo');

  if (!state.open) return null;

  const busy = state.status !== 'idle';
  const showTranscript = state.transcript !== null;

  return (
    <div
      {...verifyAttrs({
        unit: 'PhotoImportModal',
        status: state.status,
        hasTranscript: showTranscript,
        hasError: state.error.length > 0,
        hasPreview: state.previewUrl !== null,
      })}
      role="dialog"
      aria-modal="true"
      aria-label={t('modal_title')}
      className="fixed inset-0 z-[2000] flex items-center justify-center"
      // 読み取り中は待ちカーソルにする。押しても何も起きない時間があることを、
      // ボタンの文言だけでなくポインタでも伝える。
      style={{ backgroundColor: 'rgba(0,0,0,0.35)', cursor: busy ? 'wait' : undefined }}
      onClick={busy ? undefined : onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !busy) onClose();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-[90%] max-w-[520px] flex-col overflow-hidden rounded-xl shadow-lg"
        style={{ backgroundColor: 'var(--bg)' }}
      >
        <div className="px-7 pt-6 pb-3">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>
            {showTranscript ? t('transcript_heading') : t('modal_title')}
          </h3>
          {!showTranscript && (
            <>
              <p className="mt-1 text-xs" style={{ color: 'var(--date-color)' }}>
                {t('modal_description')}
              </p>
              {/* 写真が外部 AI に送られることを操作の前に明示する（docs/entry-photo-guide.md）。 */}
              <p className="mt-1.5 text-[11px] leading-snug" style={{ color: 'var(--date-color)' }}>
                {t('ai_notice')}
              </p>
            </>
          )}
        </div>

        <div className="flex-1 overflow-auto px-7">
          {state.error && (
            <p
              className="mb-3 rounded-md px-3 py-2 text-xs text-red-600"
              style={{ background: 'rgba(220,38,38,0.08)' }}
            >
              {state.error}
            </p>
          )}

          {showTranscript ? (
            state.transcript ? (
              <pre
                data-testid="photo-transcript"
                className="whitespace-pre-wrap rounded-md p-3 text-sm leading-relaxed"
                style={{ background: 'var(--toolbar-hover)', color: 'var(--fg)' }}
              >
                {state.transcript}
              </pre>
            ) : (
              <p className="text-sm" style={{ color: 'var(--date-color)' }}>
                {t('transcript_empty')}
              </p>
            )
          ) : (
            state.previewUrl && (
              // biome-ignore lint/performance/noImgElement: object URL のプレビュー。next/image は blob: を扱えない。
              <img
                src={state.previewUrl}
                alt={t('preview_alt')}
                className="max-h-[45vh] w-full rounded-md object-contain"
                style={{ background: 'var(--toolbar-hover)' }}
              />
            )
          )}
        </div>

        <div className="flex justify-end gap-2 px-7 pt-4 pb-6">
          {showTranscript ? (
            <>
              <button
                type="button"
                onClick={onDiscardTranscript}
                className="rounded-md border px-4 py-2 text-xs"
                style={{
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--fg)',
                  backgroundColor: 'var(--bg)',
                }}
              >
                {t('back')}
              </button>
              <button
                type="button"
                onClick={onInsertTranscript}
                disabled={!state.transcript}
                className="rounded-md border px-4 py-2 text-xs text-white disabled:opacity-40"
                style={{ backgroundColor: 'var(--accent)', borderColor: 'var(--accent)' }}
              >
                {t('insert')}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="rounded-md border px-4 py-2 text-xs disabled:opacity-40"
                style={{
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--fg)',
                  backgroundColor: 'var(--bg)',
                }}
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={onAttach}
                disabled={busy || !state.previewUrl}
                className="rounded-md border px-4 py-2 text-xs disabled:opacity-40"
                style={{ borderColor: 'var(--border-subtle)', color: 'var(--fg)' }}
              >
                {state.status === 'uploading' ? t('attaching') : t('attach')}
              </button>
              <button
                type="button"
                onClick={onTranscribe}
                disabled={busy || !state.previewUrl}
                className="rounded-md border px-4 py-2 text-xs text-white disabled:opacity-40"
                style={{ backgroundColor: 'var(--accent)', borderColor: 'var(--accent)' }}
              >
                {state.status === 'transcribing' ? t('transcribing') : t('transcribe')}
              </button>
              {/* 残り時間は出さない。実測の経過だけ出して「止まっていない」ことを示す。 */}
              <ElapsedSeconds
                running={state.status === 'transcribing'}
                label={(s) => t('elapsed', { seconds: s })}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
