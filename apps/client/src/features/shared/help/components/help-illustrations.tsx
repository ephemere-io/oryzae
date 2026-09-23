import { verifyAttrs } from '@oryzae/verify';
import { ICON_STROKE_WIDTH } from '@/components/ui/surface';
import { StudyIcon } from '@/features/shared/study/components/study-icon';
import type { HelpIllustrationKind } from '../types';

/**
 * 話題に添える線画。
 *
 * 書斎の物と同じ **1 本の線**で描く（面も影も塗らない）。旧オンボーディングの挿絵は
 * 別系統の色（`--ob-*`）で塗ってあり、書斎の線画の世界と別物に見えた。ここは説明の
 * 面なので**アプリの色**（`currentColor`）だけを使い、線幅はアイコンと同じ 1.6。
 *
 * 72 × 54 の箱に、机の物 1 つ。人が書いた文の隣に置く絵なので、目立たせない。
 */
const PATHS: Record<HelpIllustrationKind, string> = {
  // 書斎。机と、板・瓶・手帳。
  room: 'M6 44h60M24 8h30v18H24zM10 26h8v18h-8zM11 26v-4h6v4M40 36h16v8H40zM40 40h16',
  question:
    'M36 27m-15 0a15 15 0 1 0 30 0a15 15 0 1 0-30 0M31 22a5 5 0 0 1 10 0c0 4-5 4-5 8M36 35v.5',
  pen: 'M14 44l28-28 6 6-28 28H14zM42 16l4-4 6 6-4 4M14 44l2-8',
  jar: 'M25 10h22v5H25zM23 15h26v30a4 4 0 0 1-4 4H27a4 4 0 0 1-4-4zM27 34h18M33 26m-1.5 0a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0M40 22m-1 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0',
  notebook: 'M20 8h28a4 4 0 0 1 4 4v30a4 4 0 0 1-4 4H20zM20 8v38M26 8v38M33 20h12M33 27h12M33 34h8',
  board: 'M10 10h52v34H10zM16 16h14v10H16zM36 18h12v8H36zM20 30h18v8H20z',
  shelf: 'M10 8h52v38H10zM10 26h52M16 10v14M21 10v14M27 10v14M16 28v16M23 28v16M30 28v16',
  letter: 'M12 14h48v28H12zM12 14l24 18 24-18M12 42l18-14M60 42l-18-14',
  snippet: 'M14 12v30M58 12v30M20 20h32M20 27h22M20 34h28',
  list: 'M20 14h34M20 27h34M20 40h34M13 14h.5M13 27h.5M13 40h.5',
  timeline:
    'M12 27h48M22 27m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0M38 27m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0M54 27m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0M22 17v7M38 37v-7',
  person: 'M36 20m-8 0a8 8 0 1 0 16 0a8 8 0 1 0-16 0M18 46c0-8 8-14 18-14s18 6 18 14',
  memo: 'M22 8h28v38H22zM22 14h28M28 24h16M28 32h16',
  search: 'M31 24m-13 0a13 13 0 1 0 26 0a13 13 0 1 0-26 0M41 34l12 12',
};

export function HelpIllustration({
  kind,
  size = 72,
}: {
  kind: HelpIllustrationKind;
  /** 幅（px）。高さは 3:4 の比で決まる。 */
  size?: number;
}) {
  // 書斎は「‹ 書斎」のボタンと同じ記号（`StudyIcon`）。面の頭と戻るボタンで絵が違うと、
  // 同じ部屋に見えない。箱は 3:4 のまま、記号を中央に置く。
  if (kind === 'room') {
    return (
      <span
        {...verifyAttrs({ unit: 'HelpIllustration', kind })}
        className="inline-flex items-center justify-center"
        style={{ width: size, height: (size * 3) / 4 }}
      >
        <StudyIcon size={Math.round(size * 0.62)} />
      </span>
    );
  }
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 72 54"
      width={size}
      height={(size * 54) / 72}
      fill="none"
      stroke="currentColor"
      strokeWidth={ICON_STROKE_WIDTH}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 opacity-70"
      {...verifyAttrs({ unit: 'HelpIllustration', kind })}
    >
      <path d={PATHS[kind]} />
    </svg>
  );
}
