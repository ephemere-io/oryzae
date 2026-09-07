'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import type { PhotoImportState } from '@/features/shared/entries/types';

interface SpPhotoImportSheetProps {
  state: PhotoImportState;
  onTranscribe: () => void;
  onAttach: () => void;
  onInsertTranscript: () => void;
  onDiscardTranscript: () => void;
  onClose: () => void;
}

/**
 * 取り込んだ写真を「文字として読み込む」か「写真として貼る」か選ばせるボトムシート（SP）。
 *
 * 中身の契約は PC の PhotoImportModal と同じ（状態は usePhotoImport が持つ純表示）。
 * 見せ方だけが端末別で、SpConfirmSheet と同じ bottom-sheet の作法に揃えてある。
 * PC は横並びの3ボタンだが、SP は親指が届く縦積みにする。
 */
export function SpPhotoImportSheet({
  state,
  onTranscribe,
  onAttach,
  onInsertTranscript,
  onDiscardTranscript,
  onClose,
}: SpPhotoImportSheetProps) {
  const t = useTranslations('photo');

  const busy = state.status !== 'idle';
  const showTranscript = state.transcript !== null;

  return (
    <div
      {...verifyAttrs({
        unit: 'SpPhotoImportSheet',
        open: state.open,
        status: state.status,
        hasTranscript: showTranscript,
        hasError: state.error.length > 0,
        hasPreview: state.previewUrl !== null,
      })}
    >
      {state.open ? (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <button
            type="button"
            aria-label={t('cancel')}
            onClick={busy ? undefined : onClose}
            disabled={busy}
            className="sp-fade flex-1 bg-black/30"
          />
          <div
            className="sp-sheet max-h-[80vh] overflow-auto rounded-t-2xl bg-[var(--bg)] px-5 pt-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(0,0,0,0.15)]"
            style={{ fontFamily: 'var(--ob-font-sans)' }}
          >
            <p
              className="text-base font-medium text-[var(--fg)]"
              style={{ fontFamily: 'var(--ob-font-serif)' }}
            >
              {showTranscript ? t('transcript_heading') : t('modal_title')}
            </p>

            {/* 写真が外部 AI に送られることを操作の前に明示する（docs/entry-photo-guide.md）。 */}
            {!showTranscript ? (
              <p className="mt-1.5 text-[11px] leading-snug text-[var(--date-color)]">
                {t('ai_notice')}
              </p>
            ) : null}

            {state.error ? (
              <p className="mt-2 text-sm leading-relaxed text-[var(--ob-jar-warm)]">
                {state.error}
              </p>
            ) : null}

            {showTranscript ? (
              state.transcript ? (
                <pre
                  data-testid="sp-photo-transcript"
                  className="mt-3 max-h-[40vh] overflow-auto whitespace-pre-wrap rounded-xl p-3 text-sm leading-relaxed text-[var(--fg)]"
                  style={{ background: 'var(--toolbar-hover)' }}
                >
                  {state.transcript}
                </pre>
              ) : (
                <p className="mt-3 text-sm leading-relaxed text-[var(--date-color)]">
                  {t('transcript_empty')}
                </p>
              )
            ) : state.previewUrl ? (
              // biome-ignore lint/performance/noImgElement: object URL のプレビュー。next/image は blob: を扱えない。
              <img
                src={state.previewUrl}
                alt={t('preview_alt')}
                className="mt-3 max-h-[40vh] w-full rounded-xl object-contain"
                style={{ background: 'var(--toolbar-hover)' }}
              />
            ) : null}

            <div className="mt-5 flex flex-col gap-2">
              {showTranscript ? (
                <>
                  <button
                    type="button"
                    onClick={onInsertTranscript}
                    disabled={!state.transcript}
                    className="rounded-xl py-3 text-sm font-medium text-white disabled:opacity-50"
                    style={{ background: 'var(--accent)' }}
                  >
                    {t('insert')}
                  </button>
                  <button
                    type="button"
                    onClick={onDiscardTranscript}
                    className="rounded-xl py-3 text-sm text-[var(--fg)]"
                    style={{ border: '1px solid var(--border-subtle)' }}
                  >
                    {t('back')}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onTranscribe}
                    disabled={busy || !state.previewUrl}
                    className="flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium text-white disabled:opacity-50"
                    style={{ background: 'var(--accent)' }}
                  >
                    {state.status === 'transcribing' ? (
                      <span
                        className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
                        aria-hidden="true"
                      />
                    ) : null}
                    {state.status === 'transcribing' ? t('transcribing') : t('transcribe')}
                  </button>
                  <button
                    type="button"
                    onClick={onAttach}
                    disabled={busy || !state.previewUrl}
                    className="rounded-xl py-3 text-sm text-[var(--fg)] disabled:opacity-50"
                    style={{ border: '1px solid var(--border-subtle)' }}
                  >
                    {state.status === 'uploading' ? t('attaching') : t('attach')}
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={busy}
                    className="rounded-xl py-3 text-sm text-[var(--date-color)] disabled:opacity-50"
                  >
                    {t('cancel')}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
