'use client';

import { JAR_ICON_PATH } from './icon-paths';
import { ICON_STROKE_WIDTH } from './surface';

/**
 * 操作の列（パレット）に並べるアイコン。
 *
 * **PC と SP で同じ絵を使う。** 以前は PC のボードの道具箱が自前で持っていたため、
 * SP 側が同じ操作に別の見た目（文字だけのボタン）を出していた。reach（pc / sp）を
 * またいで import はできないので、絵そのものはここ（端末非依存の UI）に置く。
 *
 * 大きさは呼び出し側が決められる（既定はパレットの 22px。PC のボードの道具箱は
 * 面の段に合わせて小さい値を渡す）。線幅は全画面で揃える。
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

export function PhotoIcon({ size = 22 }: { size?: number }) {
  return (
    <svg {...iconProps(size)} aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 16 5-5a2 2 0 0 1 2.8 0l5.2 5.2M14 13l1.6-1.6a2 2 0 0 1 2.8 0L21 14.5" />
      <circle cx="16" cy="9" r="1" />
    </svg>
  );
}

export function FermentIcon({ size = 22 }: { size?: number }) {
  return (
    <svg {...iconProps(size)} aria-hidden="true">
      <path d={JAR_ICON_PATH} />
      <path d="M6.6 14.4c1.8.8 3.6.8 5.4 0s3.6-.8 5.4 0" strokeOpacity=".55" />
    </svg>
  );
}

export function TrashIcon({ size = 22 }: { size?: number }) {
  return (
    <svg {...iconProps(size)} aria-hidden="true">
      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
    </svg>
  );
}

/** 書く（鉛筆）。 */
function PencilIcon({ size = 22 }: { size?: number }) {
  return (
    <svg {...iconProps(size)} aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

/** スニペットを書く（鉛筆と同じ絵）。 */
export function SnippetIcon({ size = 22 }: { size?: number }) {
  return <PencilIcon size={size} />;
}

/**
 * 問いの一覧（行の並び）。追加・編集・アーカイブ・戻すをする画面への入口。＋（追加だけ）や鉛筆（編集だけ）では
 * 入口の中身を言い切れなかった（実機レビュー）。
 */
export function QuestionListIcon({ size = 22 }: { size?: number }) {
  return (
    <svg {...iconProps(size)} aria-hidden="true">
      <path d="M9 6h11M9 12h11M9 18h11" />
      <circle cx="4.5" cy="6" r="1" />
      <circle cx="4.5" cy="12" r="1" />
      <circle cx="4.5" cy="18" r="1" />
    </svg>
  );
}

export function ScanTextIcon({ size = 22 }: { size?: number }) {
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

export function OpenIcon({ size = 22 }: { size?: number }) {
  return (
    <svg {...iconProps(size)} aria-hidden="true">
      <path d="M7 17 17 7" />
      <path d="M9 7h8v8" />
    </svg>
  );
}

export function BringToFrontIcon({ size = 22 }: { size?: number }) {
  return (
    <svg {...iconProps(size)} aria-hidden="true">
      <path d="M12 3 3 8l9 5 9-5-9-5Z" />
      <path d="m3 14 9 5 9-5" />
    </svg>
  );
}

export function SendToBackIcon({ size = 22 }: { size?: number }) {
  return (
    <svg {...iconProps(size)} aria-hidden="true">
      <path d="m3 10 9 5 9-5" />
      <path d="M12 21 3 16l9-5 9 5-9 5Z" />
    </svg>
  );
}

/** 発酵の結果（手紙）。エントリーのパレットでドックを出し入れする。 */
export function LetterIcon({ size = 22 }: { size?: number }) {
  return (
    <svg {...iconProps(size)} aria-hidden="true">
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="m3.5 7.5 8.5 6 8.5-6" />
    </svg>
  );
}

/** 写真の寄せ（左 / 中央 / 右）。向きは値で変わる。 */
export function AlignIcon({
  align,
  size = 22,
}: {
  align: 'start' | 'center' | 'end';
  size?: number;
}) {
  const x = align === 'center' ? 7 : align === 'end' ? 11 : 3;
  return (
    <svg {...iconProps(size)} aria-hidden="true">
      <path d="M3 5h18M3 19h18" strokeOpacity=".45" />
      <rect x={x} y="8" width="10" height="8" rx="1.5" />
    </svg>
  );
}

/** 写真の回り込み（文字が写真を避けて流れる）。 */
export function WrapIcon({ size = 22 }: { size?: number }) {
  return (
    <svg {...iconProps(size)} aria-hidden="true">
      <rect x="3" y="6" width="8" height="8" rx="1.5" />
      <path d="M14 7h7M14 11h7M3 17h18" strokeOpacity=".55" />
    </svg>
  );
}

/** 完了（写真の操作を終える）。 */
export function CheckIcon({ size = 22 }: { size?: number }) {
  return (
    <svg {...iconProps(size)} aria-hidden="true">
      <path d="m5 12 5 5L20 7" />
    </svg>
  );
}

export function KeyboardDownIcon({ size = 22 }: { size?: number }) {
  return (
    <svg {...iconProps(size)} aria-hidden="true">
      <rect x="3" y="4" width="18" height="11" rx="2" />
      <path d="M7 8h.01M11 8h.01M15 8h.01M8 12h8M9 20l3-3 3 3" />
    </svg>
  );
}
