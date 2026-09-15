'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
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
 * 取り込んだ写真を「写真として貼る」か「文字として読み込む」か選ばせる面（PC）。
 *
 * 状態は usePhotoImport が持ち、ここは props を映すだけの純表示にしてある
 * （孤立検証を成立させるため）。文字起こし結果は必ず一度ユーザーに見せてから
 * 本文へ入れる — OCR は必ず外すので、勝手に本文を書き換えないという設計判断。
 *
 * ## 言葉は一度だけ
 *
 * **押した操作の名前を、開いた面の題にもう一度書かない。** 「写真を取り込む」を押して
 * 開いた面に「写真を取り込む」と題が付いていて、その下に「文字として読み込むか、
 * 写真としてそのまま貼るかを選べます」と書いてあった。どちらも画面がすでに言っている。
 * 残すのは**問い**（この写真を取り込みますか？）と、押す前に知らせるべきこと
 * （写真が外へ出る）だけにする。
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

  /** 選ぶ二択の見た目。**どちらも同じ**（片方だけ濃いと、そちらが正解に見える）。 */
  const choiceClass = 'rounded-md px-4 py-2 text-xs font-medium disabled:opacity-40';
  const choiceStyle = { backgroundColor: 'var(--surface-sunken)', color: 'var(--fg)' };

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
      style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}
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
        <div className="px-7 pt-6 pb-3 text-center">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>
            {showTranscript ? t('transcript_heading') : t('modal_title')}
          </h3>
          {!showTranscript && (
            // 写真が外へ出ることだけは、押す前に言う（docs/entry-photo-guide.md）。
            <p className="mt-1.5 text-[11px] leading-snug" style={{ color: 'var(--date-color)' }}>
              {t('ai_notice')}
            </p>
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

        {/* **選ぶものは真ん中に、やめるものは右端に。** 二択は写真の下、目の通り道に置く。
            キャンセルは「選ばない」であって三つ目の選択肢ではないので、並びの外側（右端）に
            置き、地を持たせず字の色を落として下がらせる。 */}
        <div className="flex justify-center gap-2 px-7 pt-4 pb-6">
          {showTranscript ? (
            <>
              <button
                type="button"
                onClick={onDiscardTranscript}
                className="rounded-md px-4 py-2 text-xs"
                style={{ color: 'var(--date-color)' }}
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
                onClick={onAttach}
                disabled={busy || !state.previewUrl}
                className={choiceClass}
                style={choiceStyle}
              >
                {state.status === 'uploading' ? t('attaching') : t('attach')}
              </button>
              <button
                type="button"
                onClick={onTranscribe}
                disabled={busy || !state.previewUrl}
                className={choiceClass}
                style={choiceStyle}
              >
                {state.status === 'transcribing' ? t('transcribing') : t('transcribe')}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="rounded-md px-4 py-2 text-xs disabled:opacity-40"
                style={{ color: 'var(--date-color)' }}
              >
                {t('cancel')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
