'use client';

import { useTranslations } from 'next-intl';
import { type ReactNode, useState } from 'react';
import { FloatingPalette } from '@/components/ui/floating-palette';
import {
  CONTROL_FONT,
  DISABLED_CLASS,
  HOVER_CLASS,
  type PaletteSize,
  TOOL_BUTTON_CLASS,
} from '@/components/ui/surface';

export interface PaletteAction {
  id: string;
  label: string;
  icon: ReactNode;
  onSelect: () => void;
  /** 押せないときの理由。ホバーで出す（ボタンは押せないまま）。 */
  disabledReason?: string;
  /** 押している最中（録音中など）。 */
  active?: boolean;
}

interface EntryActionPaletteProps {
  /** 道具の大きさ（設定で変えられる）。既定は medium。 */
  size?: PaletteSize;
  actions: PaletteAction[];
  /** フォーカスモードで本文以外を消しているあいだは false。 */
  visible: boolean;
  /**
   * 位置と畳み具合を localStorage に覚えるか（既定 true）。
   * 孤立検証（verify）では fixture をまたいで状態が漏れるので false にする。
   */
  persistState?: boolean;
}

// 旧 `oryzae-entry-palette-position`（左上からの px）とは別の鍵にする。
// 同じ鍵のまま意味を変えると、前の値が新しい意味で読まれて明後日の場所に出る。
const STORAGE = {
  anchor: 'oryzae-entry-palette-anchor',
  collapsed: 'oryzae-entry-palette-collapsed',
} as const;

/**
 * エントリー画面の操作をまとめたフローティングパレット。
 *
 * 「問いを結ぶ」「漬け込む」「写真から文字を起こす」「全画面」「音声入力」といった
 * **操作**をここに集める。本文の周りに操作を散らかさないためのもの。
 *
 * 動かす・畳む・消える、の振る舞いと面の見た目は `FloatingPalette`（ボードの道具箱と
 * 共通）が持つ。ここが持つのは並べる操作と、押せないときの理由の出し方だけ。
 *
 * 押せない操作は `aria-disabled` にして、理由はホバーで出す。本当の `disabled` にすると
 * React がマウス系イベントを抑止し、フォーカスも受けないため、理由に到達できなくなる。
 */
export function EntryActionPalette({
  actions,
  visible,
  size = 'medium',
  persistState = true,
}: EntryActionPaletteProps) {
  const t = useTranslations('editor.palette');
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <FloatingPalette
      contract={{ unit: 'EntryActionPalette', actionCount: actions.length, size }}
      size={size}
      visible={visible}
      storage={persistState ? STORAGE : null}
      collapseLabel={t('collapse')}
      expandLabel={t('expand')}
    >
      {({ scale, consumeMoved }) =>
        actions.map((action) => {
          const disabled = Boolean(action.disabledReason);
          return (
            // ホバーの検出は**ラッパー側**で行う。React は `disabled` な button に対して
            // onMouseEnter を抑止するため、押せない操作の理由が出なくなる。
            // biome-ignore lint/a11y/noStaticElementInteractions: ホバーは理由の補足表示だけで、操作そのものは中の button が担う（onFocus/onBlur でキーボードからも同じ理由に到達できる）
            <span
              key={action.id}
              className="relative flex"
              onMouseEnter={() => setHoveredId(action.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <button
                type="button"
                aria-disabled={disabled}
                onClick={() => {
                  if (disabled) return;
                  // 掴んで動かした直後の click は、操作ではなく移動の余韻。
                  if (consumeMoved()) return;
                  action.onSelect();
                }}
                aria-label={action.label}
                data-palette-action={action.id}
                onFocus={() => setHoveredId(action.id)}
                onBlur={() => setHoveredId(null)}
                className={`${TOOL_BUTTON_CLASS} ${
                  disabled ? DISABLED_CLASS : action.active ? '' : HOVER_CLASS
                }`}
                style={{
                  height: scale.button,
                  width: scale.button,
                  borderRadius: scale.buttonRadius,
                  ...(action.active
                    ? { backgroundColor: 'var(--accent)', color: '#fff' }
                    : { color: 'var(--fg)' }),
                }}
              >
                {action.icon}
              </button>
              {hoveredId === action.id && (
                <span
                  role="tooltip"
                  className="pointer-events-none absolute bottom-full left-1/2 z-[1610] mb-2 max-w-[16rem] -translate-x-1/2 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-medium"
                  style={{ backgroundColor: 'var(--fg)', color: 'var(--bg)', ...CONTROL_FONT }}
                >
                  {action.disabledReason ?? action.label}
                </span>
              )}
            </span>
          );
        })
      }
    </FloatingPalette>
  );
}
