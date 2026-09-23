'use client';

import { ICON_STROKE_WIDTH } from './surface';

/**
 * 操作の列（パレット）に並べるアイコン。
 *
 * **PC と SP で同じ絵を使う。** 以前は PC のボードの道具箱が自前で持っていたため、
 * SP 側が同じ操作に別の見た目（文字だけのボタン）を出していた。reach（pc / sp）を
 * またいで import はできないので、絵そのものはここ（端末非依存の UI）に置く。
 *
 * 大きさは呼び出し側が決める（PC は面の段に従い、SP は指の当たりに合わせる）。
 */

function iconProps(size: number) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: ICON_STROKE_WIDTH,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  } as const;
}

export function SnippetIcon({ size = 18 }: { size?: number }) {
  return (
    <svg {...iconProps(size)} aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

export function PhotoIcon({ size = 18 }: { size?: number }) {
  return (
    <svg {...iconProps(size)} aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

/** 画像から文字を読み取る。枠の中に字がある形で「写真そのもの」と区別する。 */
export function ScanTextIcon({ size = 18 }: { size?: number }) {
  return (
    <svg {...iconProps(size)} aria-hidden="true">
      <path d="M3 8V5a2 2 0 0 1 2-2h3" />
      <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
      <path d="M3 16v3a2 2 0 0 0 2 2h3" />
      <path d="M21 16v3a2 2 0 0 1-2 2h-3" />
      <path d="M7 10h10M7 14h6" />
    </svg>
  );
}

export function OpenIcon({ size = 18 }: { size?: number }) {
  return (
    <svg {...iconProps(size)} aria-hidden="true">
      <path d="M7 17 17 7" />
      <path d="M9 7h8v8" />
    </svg>
  );
}

export function BringToFrontIcon({ size = 18 }: { size?: number }) {
  return (
    <svg {...iconProps(size)} aria-hidden="true">
      <path d="M12 3 3 8l9 5 9-5-9-5Z" />
      <path d="m3 14 9 5 9-5" />
    </svg>
  );
}

export function TrashIcon({ size = 18 }: { size?: number }) {
  return (
    <svg {...iconProps(size)} aria-hidden="true">
      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
    </svg>
  );
}
