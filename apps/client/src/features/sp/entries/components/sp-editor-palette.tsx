'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { JAR_ICON_PATH } from '@/components/ui/icon-paths';
import { CONTROL_FONT, ICON_STROKE_WIDTH } from '@/components/ui/surface';

type SpEditorActionId = 'question' | 'photo' | 'ferment' | 'delete';

export interface SpEditorAction {
  id: SpEditorActionId;
  /** 読み上げに出す名前（アイコンだけの列なので必須）。 */
  label: string;
  onSelect: () => void;
  /** 押せない理由。あれば押せない（理由は読み上げに添える）。 */
  disabledReason?: string;
  /** いま効いている状態（問いを結んでいる等）。印を添える。 */
  active?: boolean;
  /** 送信中など、一時的に押せない。 */
  busy?: boolean;
  tone?: 'normal' | 'danger';
}

interface SpEditorPaletteProps {
  actions: SpEditorAction[];
}

/** 列の高さ（px）。エディタの下端はこのぶん空ける。 */
export const SP_EDITOR_PALETTE_HEIGHT = 52;

/**
 * 画面の下端からキーボードの上端までの距離（px）。キーボードが無ければ 0。
 *
 * iOS の Safari はキーボードが出ても `window.innerHeight` を変えず、`visualViewport` の
 * 高さだけが縮む。その差がキーボードの高さになる。
 */
function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => {
      const next = Math.max(0, window.innerHeight - (viewport.offsetTop + viewport.height));
      setInset(Math.round(next));
    };
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
    };
  }, []);
  return inset;
}

/**
 * SP エディタの操作パレット。**キーボードの真上に付いてくる**（Notion のモバイルの
 * キーボードツールバーと同じ位置）。キーボードが無ければ画面の下端。
 *
 * 本文の周りに操作を散らかさないためのもので、PC の `EntryActionPalette` と同じ役目。
 * 並べるのは問いを結ぶ・写真・発酵・削除。右端はキーボードを閉じる（出ているときだけ）。
 *
 * `fixed` なので、エディタ本体は `SP_EDITOR_PALETTE_HEIGHT` ぶん下端を空けておく。
 */
export function SpEditorPalette({ actions }: SpEditorPaletteProps) {
  const t = useTranslations('sp.editor');
  const keyboard = useKeyboardInset();

  return (
    <div
      {...verifyAttrs({
        unit: 'SpEditorPalette',
        actionCount: actions.length,
        keyboardOpen: keyboard > 0,
      })}
      role="toolbar"
      aria-label={t('palette_aria')}
      className="fixed inset-x-0 z-[60] flex items-center gap-1 px-2"
      style={{
        ...CONTROL_FONT,
        bottom: keyboard,
        height: SP_EDITOR_PALETTE_HEIGHT,
        // キーボードが無いときはホームインジケータの上に載る。
        paddingBottom: keyboard > 0 ? 0 : 'env(safe-area-inset-bottom, 0px)',
        boxSizing: 'content-box',
        background: 'var(--surface-raised)',
        borderTop: '1px solid var(--surface-raised-border)',
      }}
    >
      {actions.map((action) => {
        const disabled = Boolean(action.disabledReason) || Boolean(action.busy);
        return (
          <button
            key={action.id}
            type="button"
            aria-label={
              action.disabledReason ? `${action.label}（${action.disabledReason}）` : action.label
            }
            aria-disabled={disabled}
            data-palette-action={action.id}
            onClick={() => {
              if (disabled) return;
              action.onSelect();
            }}
            className={`relative flex h-11 w-11 items-center justify-center rounded-xl transition-colors active:scale-95 ${
              disabled ? 'opacity-40' : 'hover:bg-[var(--hover-wash)]'
            }`}
            style={{
              color:
                action.tone === 'danger'
                  ? 'var(--ob-jar-warm)'
                  : action.active
                    ? 'var(--accent)'
                    : 'var(--fg)',
            }}
          >
            {action.busy ? (
              <span
                className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                aria-hidden="true"
              />
            ) : (
              <ActionIcon id={action.id} />
            )}
            {action.active ? (
              <span
                aria-hidden="true"
                className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full"
                style={{ background: 'var(--accent)' }}
              />
            ) : null}
          </button>
        );
      })}

      <span className="flex-1" />

      {/* キーボードを閉じる。出ているときだけ（Notion と同じ右端）。 */}
      {keyboard > 0 ? (
        <button
          type="button"
          aria-label={t('dismiss_keyboard')}
          onClick={() => {
            if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
          }}
          className="flex h-11 w-11 items-center justify-center rounded-xl transition-colors hover:bg-[var(--hover-wash)] active:scale-95"
          style={{ color: 'var(--date-color)' }}
        >
          <svg
            aria-hidden="true"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={ICON_STROKE_WIDTH}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="4" width="18" height="11" rx="2" />
            <path d="M7 8h.01M11 8h.01M15 8h.01M8 12h8M9 20l3-3 3 3" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}

function ActionIcon({ id }: { id: SpEditorActionId }) {
  const props = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: ICON_STROKE_WIDTH,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  } as const;
  switch (id) {
    case 'question':
      return (
        <svg {...props} aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 9.5a2.5 2.5 0 0 1 5 0c0 1.5-2.5 2-2.5 3.5M12 17h.01" />
        </svg>
      );
    case 'photo':
      return (
        <svg {...props} aria-hidden="true">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 16 5-5a2 2 0 0 1 2.8 0l5.2 5.2M14 13l1.6-1.6a2 2 0 0 1 2.8 0L21 14.5" />
          <circle cx="16" cy="9" r="1" />
        </svg>
      );
    case 'ferment':
      return (
        <svg {...props} aria-hidden="true">
          <path d={JAR_ICON_PATH} />
          <path d="M6.6 14.4c1.8.8 3.6.8 5.4 0s3.6-.8 5.4 0" strokeOpacity=".55" />
        </svg>
      );
    case 'delete':
      return (
        <svg {...props} aria-hidden="true">
          <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
        </svg>
      );
  }
}
