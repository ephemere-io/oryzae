'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { CONTROL_FONT, ELEVATED_CHIP_CLASS, ELEVATED_CHIP_STYLE } from '@/components/ui/surface';

export interface HelpWelcomeProps {
  /** 案内（面）がどちらに居るか。PC は右の面、SP は下のシート。 */
  guide: 'right' | 'below';
  onStart: () => void;
}

/**
 * 初めての人が最初に見る 1 枚（`docs/help-mode-guide.md`「初めての人」）。
 *
 * 書斎を初めて見せられても、何の部屋か分からない。面以外を半透明で沈め、伝えることを
 * **2 つだけ**にする — 使い方は面（右／下）にあること、まず試してみればいいこと。
 * ボタンを押すと沈みが晴れ、面はそのまま残る（三歩が見えている）。
 *
 * 面の側は沈めない。PC は右端を面の幅（`--help-width`）で止め、SP はシートの上端で止める。
 * 沈みを押しても晴れる（ボタンを探させない）。
 */
export function HelpWelcome({ guide, onStart }: HelpWelcomeProps) {
  const t = useTranslations('help.welcome');

  return (
    <div
      {...verifyAttrs({ unit: 'HelpWelcome', guide })}
      className="help-fade fixed inset-0 z-[1650] flex items-center justify-center"
      style={{
        right: guide === 'right' ? 'var(--help-width, 0px)' : 0,
        bottom: guide === 'below' ? '82dvh' : 0,
        background: 'color-mix(in srgb, var(--bg) 82%, transparent)',
        backdropFilter: 'blur(2px)',
        WebkitBackdropFilter: 'blur(2px)',
        ...CONTROL_FONT,
      }}
    >
      {/* 沈みを押しても晴れる。 */}
      <button
        type="button"
        aria-label={t('start')}
        onClick={onStart}
        className="absolute inset-0"
      />
      <div className="relative flex max-w-[22rem] flex-col items-center gap-5 px-6 text-center">
        <p className="text-[26px] font-medium tracking-[0.02em] text-[var(--fg)]">{t('title')}</p>
        <p className="text-[14px] leading-[1.9] text-[var(--fg)] opacity-80">
          {guide === 'right' ? t('guide_right') : t('guide_below')}
        </p>
        <button
          type="button"
          onClick={onStart}
          className={`flex h-10 items-center gap-2 px-5 text-[13px] font-medium ${ELEVATED_CHIP_CLASS}`}
          style={{ ...ELEVATED_CHIP_STYLE, color: 'var(--accent)' }}
        >
          {t('start')}
          <span aria-hidden="true">{guide === 'right' ? '→' : '↓'}</span>
        </button>
      </div>
    </div>
  );
}
