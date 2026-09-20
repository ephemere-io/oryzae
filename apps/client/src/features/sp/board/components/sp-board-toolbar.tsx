'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import {
  BringToFrontIcon,
  OpenIcon,
  PhotoIcon,
  SnippetIcon,
  TrashIcon,
} from '@/components/ui/palette-icons';
import { CONTROL_FONT } from '@/components/ui/surface';

/**
 * SP のボードの操作の列。
 *
 * **PC と同じ語彙（アイコン）で、モバイルの作法で置く。** 文字だけのボタンを並べていた
 * ころは、PC の道具箱と同じ操作なのに別の物に見えた。ただし PC の `FloatingPalette`
 * （掴んで動かせる・畳める・ホバーで名前が出る）はそのままでは使えない — スマホには
 * ホバーが無く、掴む操作は盤面の指の操作と食い合う。そこで **アイコンに短い名前を
 * 添えた下端の列**にする（#616 の `ActionPalette` と同じ形）。
 *
 * PC（#524）と同じく、**選んでいるものに応じて中身が入れ替わる**:
 *  - 何も選んでいない … 作るもの（抜粋 / 写真）
 *  - カードを選んでいる … そのカードにできること（編集 / 前面へ / 外す）
 *
 * 寄り引き（− / 100% / + / FIT）はここではなく盤面の左下（`CanvasZoomControls`）。
 * 盤面に対する操作と、貼ってあるものに対する操作を混ぜない。
 */

/** 道具箱の 2 つの顔。契約（data-verify-mode）に出す値でもある。 */
type ToolbarMode = 'create' | 'card';

export interface SpBoardToolbarProps {
  /** 選んでいるカードの種類。`null` なら何も選んでいない。 */
  selectedType: 'snippet' | 'photo' | null;
  /** カードを選んでいる間、編集できるか（抜粋だけ）。 */
  onEdit?: () => void;
  onBringToFront?: () => void;
  onDelete?: () => void;
  onCreateSnippet?: () => void;
  onCreatePhoto?: () => void;
  /** 何かを作っている最中（連打で二重に作らせない）。 */
  busy?: boolean;
}

/** 列の高さ（px）。ホームインジケータぶんの余白は別に足す。 */
const PALETTE_HEIGHT = 56;
/** 指で押す前提のアイコン。PC（18px）より一回り大きい。 */
const ICON_SIZE = 20;

interface PaletteAction {
  id: string;
  /** 読み上げに出す正式な名前。 */
  label: string;
  /** 目に見える短い名前。 */
  caption: string;
  icon: ReactNode;
  onSelect?: () => void;
  disabled?: boolean;
  tone?: 'normal' | 'danger';
  /** 新しいものを作る道具か（作っている最中は押せなくする対象）。 */
  creates?: boolean;
}

export function SpBoardToolbar({
  selectedType,
  onEdit,
  onBringToFront,
  onDelete,
  onCreateSnippet,
  onCreatePhoto,
  busy = false,
}: SpBoardToolbarProps) {
  const t = useTranslations('sp.board');
  const mode: ToolbarMode = selectedType === null ? 'create' : 'card';

  const actions: PaletteAction[] =
    mode === 'create'
      ? [
          {
            id: 'snippet',
            label: t('add_snippet'),
            caption: t('snippet_caption'),
            icon: <SnippetIcon size={ICON_SIZE} />,
            onSelect: onCreateSnippet,
            disabled: busy,
            creates: true,
          },
          {
            id: 'photo',
            label: t('add_photo'),
            caption: t('photo_caption'),
            icon: <PhotoIcon size={ICON_SIZE} />,
            onSelect: onCreatePhoto,
            disabled: busy,
            creates: true,
          },
        ]
      : [
          // 写真は本文を持たないので編集を出さない（押せるのに何も起きない、を作らない）。
          ...(selectedType === 'snippet'
            ? [
                {
                  id: 'edit',
                  label: t('edit'),
                  caption: t('edit'),
                  icon: <OpenIcon size={ICON_SIZE} />,
                  onSelect: onEdit,
                },
              ]
            : []),
          {
            id: 'front',
            label: t('bring_to_front'),
            caption: t('bring_to_front'),
            icon: <BringToFrontIcon size={ICON_SIZE} />,
            onSelect: onBringToFront,
          },
          {
            id: 'remove',
            label: t('remove'),
            caption: t('remove'),
            icon: <TrashIcon size={ICON_SIZE} />,
            onSelect: onDelete,
            tone: 'danger' as const,
          },
        ];

  return (
    <div
      {...verifyAttrs({
        unit: 'SpBoardToolbar',
        mode,
        selectedType: selectedType ?? 'none',
        busy,
        actionCount: actions.length,
      })}
      role="toolbar"
      aria-label={mode === 'create' ? t('add_snippet') : t('edit')}
      className="flex w-full shrink-0 items-stretch justify-center gap-1 px-2"
      style={{
        ...CONTROL_FONT,
        height: PALETTE_HEIGHT,
        boxSizing: 'content-box',
        // ホームインジケータの上に載せる。
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        background: 'var(--surface-raised)',
        borderTop: '1px solid var(--border-subtle)',
      }}
    >
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          data-palette-action={action.id}
          data-verify-creates={action.creates ? '' : undefined}
          aria-label={action.label}
          onClick={action.onSelect}
          disabled={action.disabled || action.onSelect === undefined}
          className="flex min-w-[60px] flex-col items-center justify-center gap-1 whitespace-nowrap rounded-xl px-3 transition-opacity active:scale-95 disabled:opacity-40"
          style={{ color: action.tone === 'danger' ? 'var(--ob-jar-warm)' : 'var(--fg)' }}
        >
          {action.icon}
          <span aria-hidden="true" className="text-[10px] leading-none tracking-[0.04em]">
            {action.caption}
          </span>
        </button>
      ))}
    </div>
  );
}
