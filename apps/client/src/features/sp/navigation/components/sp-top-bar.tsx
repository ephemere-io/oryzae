'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { RoundButton } from '@/components/ui/round-button';
import { CONTROL_FONT, ICON_STROKE_WIDTH } from '@/components/ui/surface';
import { useSpChrome } from '@/lib/sp-chrome-context';

const SP_TOP_BAR_HEIGHT = 48;

/**
 * SP のサブ画面の上段（Notion のモバイルの骨格）。
 *
 * - 左端: 正円の戻る。既定は書斎（/）へ。画面が横取りしていればその手（`useSpBackHandler`）
 * - 中央: 状態だけ（`useSpStatus`）
 * - 右端: **画面ごとの設定の席**（`useSpChrome().actionSlot`）。エディタなら本文の見た目、
 *   無い画面では空。以前はここが全画面でアカウントへのリンクだったが、「エントリー画面の
 *   歯車がマイページに飛ぶのは謎」と実機レビュー。アカウントは書斎のアバターが担う
 *
 * 外側の余白は 16px（Notion のモバイルと同じ）。以前の 8px は縁に近すぎた。
 */
export function SpTopBar() {
  const t = useTranslations('study');
  const tNav = useTranslations('sp.nav');
  const { back, status, setActionSlot } = useSpChrome();

  return (
    <header
      {...verifyAttrs({
        unit: 'SpTopBar',
        overridesBack: back !== null,
        hasStatus: status !== null,
      })}
      className="flex shrink-0 items-center gap-2 px-4"
      style={{
        ...CONTROL_FONT,
        height: `calc(${SP_TOP_BAR_HEIGHT}px + env(safe-area-inset-top, 0px))`,
        paddingTop: 'env(safe-area-inset-top, 0px)',
      }}
    >
      {back ? (
        <RoundButton ariaLabel={tNav('back')} onClick={back}>
          <ChevronLeftIcon />
        </RoundButton>
      ) : (
        <RoundButton ariaLabel={t('back_to_study')} href="/">
          <ChevronLeftIcon />
        </RoundButton>
      )}

      <span
        aria-live="polite"
        className="min-w-0 flex-1 truncate text-center text-[12px]"
        style={{ color: statusColor(status?.tone) }}
      >
        {status ? `${status.tone === 'ok' ? '✓ ' : ''}${status.text}` : ''}
      </span>

      {/* 右端の席。画面が portal で差し込む。空でも幅を持ち、中央の状態が左右対称に収まる。 */}
      <div
        ref={setActionSlot}
        data-sp-action-slot
        className="flex h-11 min-w-11 shrink-0 items-center justify-end"
      />
    </header>
  );
}

function statusColor(tone: 'ok' | 'saving' | 'error' | undefined): string {
  if (tone === 'error') return 'var(--ob-jar-warm)';
  if (tone === 'saving') return 'var(--date-color)';
  return 'var(--accent)';
}

function ChevronLeftIcon() {
  return (
    <svg
      aria-hidden="true"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={ICON_STROKE_WIDTH + 0.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m14.5 5.5-6.5 6.5 6.5 6.5" />
    </svg>
  );
}
