'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { BRAND_MARK_SVG, svgDataUri } from '@/lib/brand';

interface PickleSuccessModalProps {
  open: boolean;
  onClose: () => void;
}

const BRAND_MARK_DATA_URI = svgDataUri(BRAND_MARK_SVG);

/**
 * Issue #322: 漬け込みアニメーション後の Jar 画面で、漬け込み完了を
 * 知らせるグラフィカルなメッセージモーダル。ブランドマークを添えて
 * 楽しい印象を演出する。
 */
export function PickleSuccessModal({ open, onClose }: PickleSuccessModalProps) {
  const t = useTranslations('fermentation.jar.pickle_success_modal');

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('aria_label')}
      className="fixed inset-0 z-[2000] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        className="w-[90%] max-w-[440px] rounded-xl shadow-lg"
        style={{ backgroundColor: 'var(--bg)', padding: '32px 32px 28px' }}
      >
        <div className="mb-4 flex justify-center">
          <Image
            src={BRAND_MARK_DATA_URI}
            alt=""
            width={80}
            height={80}
            className="select-none"
            draggable={false}
            unoptimized
          />
        </div>
        <h3 className="mb-3 text-center text-sm font-semibold" style={{ color: 'var(--fg)' }}>
          {t('heading')}
        </h3>
        <p className="mb-6 text-center text-xs leading-relaxed" style={{ color: 'var(--fg)' }}>
          {t('body')}
        </p>
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border px-5 py-2 text-xs"
            style={{
              borderColor: 'var(--accent)',
              color: 'var(--accent)',
              backgroundColor: 'var(--bg)',
            }}
          >
            {t('dismiss')}
          </button>
        </div>
      </div>
    </div>
  );
}
