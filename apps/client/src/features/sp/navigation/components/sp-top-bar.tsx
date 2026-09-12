'use client';

import { verifyAttrs } from '@oryzae/verify';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { CONTROL_FONT, ICON_STROKE_WIDTH } from '@/components/ui/surface';
import { useSpChrome } from '@/lib/sp-chrome-context';

/** 上段の高さ（px）。外枠の行の高さと同じ線に乗せる。 */
const SP_TOP_BAR_HEIGHT = 48;

interface SpTopBarProps {
  /** 右端の設定（アカウント）。アカウント画面そのものでは出さない。 */
  showSettings?: boolean;
}

/**
 * SP のサブ画面の上段。**左端に正円の「戻る」、右端に正円の「設定」。**
 *
 * Notion のモバイルと同じ骨格: 画面のいちばん上の 1 行に、戻る（左）と画面の操作（右）
 * だけを置き、中身はそのすぐ下から始まる。以前はサブ画面の下端に「書斎に戻る」の帯を
 * 敷いていたが、「フッターに出すのはダサい」と言われた。戻り道は人が探す場所（左上）に。
 *
 * - 戻るは既定で書斎（/）へのリンク。開いている画面が横取りしていれば（瓶の中の問い等）
 *   まずその画面を閉じる（`useSpBackHandler`）
 * - 中央は状態だけ（エディタの「保存しました」）。題は置かない
 * - 設定はアカウント画面へ。SP の設定（表示名・言語・テーマ）はそこにある
 */
export function SpTopBar({ showSettings = true }: SpTopBarProps) {
  const t = useTranslations('study');
  const tNav = useTranslations('sp.nav');
  const { back, status } = useSpChrome();

  return (
    <header
      {...verifyAttrs({
        unit: 'SpTopBar',
        overridesBack: back !== null,
        hasStatus: status !== null,
        showSettings,
      })}
      className="flex shrink-0 items-center gap-2 px-2"
      style={{
        ...CONTROL_FONT,
        height: `calc(${SP_TOP_BAR_HEIGHT}px + env(safe-area-inset-top, 0px))`,
        paddingTop: 'env(safe-area-inset-top, 0px)',
      }}
    >
      {back ? (
        <button
          type="button"
          onClick={back}
          aria-label={tNav('back')}
          className={ROUND_BUTTON_CLASS}
          style={ROUND_BUTTON_STYLE}
        >
          <ChevronLeftIcon />
        </button>
      ) : (
        <Link
          href="/"
          aria-label={t('back_to_study')}
          className={ROUND_BUTTON_CLASS}
          style={ROUND_BUTTON_STYLE}
        >
          <ChevronLeftIcon />
        </Link>
      )}

      <span
        aria-live="polite"
        className="min-w-0 flex-1 truncate text-center text-[12px]"
        style={{ color: statusColor(status?.tone) }}
      >
        {status ? `${status.tone === 'ok' ? '✓ ' : ''}${status.text}` : ''}
      </span>

      {showSettings ? (
        <Link
          href="/account"
          aria-label={tNav('account')}
          className={ROUND_BUTTON_CLASS}
          style={ROUND_BUTTON_STYLE}
        >
          <GearIcon />
        </Link>
      ) : (
        // 右端の席は空けておく（中央の状態が左右対称に収まる）。
        <span aria-hidden="true" className="h-11 w-11 shrink-0" />
      )}
    </header>
  );
}

/** 正円のボタン。44px の当たりに、一段沈んだ地の円。 */
const ROUND_BUTTON_CLASS =
  'flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors active:scale-95';
const ROUND_BUTTON_STYLE = {
  background: 'var(--surface-sunken)',
  color: 'var(--fg)',
} as const;

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

function GearIcon() {
  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={ICON_STROKE_WIDTH}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  );
}
