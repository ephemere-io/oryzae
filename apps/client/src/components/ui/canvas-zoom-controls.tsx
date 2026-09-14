'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { MAX_SCALE, MIN_SCALE } from '@/lib/canvas/viewport';

interface CanvasZoomControlsProps {
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  /** 倍率ラベルのクリック＝等倍に戻す。 */
  onReset: () => void;
  /** 中身全体が収まるようにズーム。 */
  onFit: () => void;
}

/** 端数で上限・下限判定がぶれないように、比較にだけ使う許容誤差。 */
const SCALE_EPSILON = 0.001;

const btnBase =
  'flex h-7 w-7 items-center justify-center rounded-full border text-[13px] leading-none transition-colors disabled:opacity-30';

/**
 * キャンバスのズーム操作（−／倍率／＋／全体表示）。
 *
 * ボードにも瓶にも出すのでドメインを知らない。`features/pc/{board,fermentation}` は
 * reach-slice-isolation で相互 import できないため、共有できる置き場はここだけになる
 * （置き場の決定木 1「ドメインを知らない汎用 UI」）。
 *
 * 状態は持たず倍率だけを props で受け、%表示と上限・下限の無効化を導出する。
 */
export function CanvasZoomControls({
  scale,
  onZoomIn,
  onZoomOut,
  onReset,
  onFit,
}: CanvasZoomControlsProps) {
  const t = useTranslations('canvas.zoom');
  const atMin = scale <= MIN_SCALE + SCALE_EPSILON;
  const atMax = scale >= MAX_SCALE - SCALE_EPSILON;
  const percent = Math.round(scale * 100);

  return (
    <div
      {...verifyAttrs({ unit: 'CanvasZoomControls', percent, atMin, atMax })}
      className="absolute bottom-4 left-4 z-20 flex items-center gap-1.5"
      style={{ fontFamily: 'Inter, sans-serif' }}
    >
      <button
        type="button"
        aria-label={t('out_aria')}
        onClick={onZoomOut}
        disabled={atMin}
        className={btnBase}
        style={{ borderColor: 'var(--border-subtle)', color: 'var(--date-color)' }}
      >
        −
      </button>
      <button
        type="button"
        aria-label={t('reset_aria')}
        onClick={onReset}
        className="min-w-[46px] rounded-full border px-2 py-1 text-[10px] tabular-nums tracking-[0.1em] transition-colors"
        style={{ borderColor: 'var(--border-subtle)', color: 'var(--date-color)' }}
      >
        {percent}%
      </button>
      <button
        type="button"
        aria-label={t('in_aria')}
        onClick={onZoomIn}
        disabled={atMax}
        className={btnBase}
        style={{ borderColor: 'var(--border-subtle)', color: 'var(--date-color)' }}
      >
        ＋
      </button>
      <button
        type="button"
        aria-label={t('fit_aria')}
        onClick={onFit}
        className="rounded-full border px-2.5 py-1 text-[9px] uppercase tracking-[0.15em] transition-colors"
        style={{ borderColor: 'var(--border-subtle)', color: 'var(--date-color)' }}
      >
        {t('fit')}
      </button>
    </div>
  );
}
