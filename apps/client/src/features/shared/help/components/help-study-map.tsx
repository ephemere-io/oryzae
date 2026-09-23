'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useId } from 'react';
import { CONTROL_FONT } from '@/components/ui/surface';
import type { HelpTopicId } from '../types';

export interface HelpStudyMapProps {
  /** 書斎の部品（描く物）。知らない id は描かない。 */
  parts: readonly HelpTopicId[];
  /** 札の字（話題の題）。 */
  titles: ReadonlyMap<HelpTopicId, string>;
  /** 灯っている物。 */
  active: HelpTopicId | null;
  /** 留めてある物（押した）。 */
  pinned: HelpTopicId | null;
  onHover: (part: HelpTopicId | null) => void;
  onPress: (part: HelpTopicId) => void;
}

/**
 * 物ごとの線と、当たりと、札の位置。座標は 300 × 190 の箱。
 *
 * 書斎（3D）と同じ構図 — 手前に机、奥の壁に板、机の左に瓶、真ん中に手帳の束、右奥に書庫、
 * 手前右に鉛筆。線は書斎の物と同じ 1 本の線で、面も影も塗らない。
 */
interface Piece {
  /** 見える線。 */
  lines: readonly string[];
  /** 当たり（見えない面）。線より少し大きい。 */
  hit: string;
  /** 札の位置と寄せ。 */
  label: { x: number; y: number; anchor: 'start' | 'middle' | 'end' };
}

const PIECES: Partial<Record<HelpTopicId, Piece>> = {
  board: {
    lines: [
      'M98 18h112v62H98z',
      'M98 39h112M98 60h112M135 18v62M173 18v62',
      'M108 28h16v9h-16zM150 47h20v9h-20z',
    ],
    hit: 'M92 12h124v74H92z',
    label: { x: 154, y: 94, anchor: 'middle' },
  },
  jar: {
    lines: [
      'M50 88h26v6H50z',
      'M48 94c-9 10-11 28-4 44h38c7-16 5-34-4-44z',
      // 泡。帯線と 2 つの泡を並べると顔に見えたので、大きさを変えて散らす。
      'M56 118m-1.5 0a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0M67 110m-1 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0M62 128m-.9 0a.9 .9 0 1 0 1.8 0a.9 .9 0 1 0-1.8 0M70 124m-.7 0a.7 .7 0 1 0 1.4 0a.7 .7 0 1 0-1.4 0',
    ],
    hit: 'M40 84h46v58H40z',
    label: { x: 63, y: 158, anchor: 'middle' },
  },
  // 手帳の束。3D と同じく厚い手帳を 3 冊重ねる。小さな窓（封筒に見えた）は描かない。
  notebook: {
    lines: [
      'M118 118h66l16-12h-66zM118 118v7h66v-7M184 118l16-12v7l-16 12',
      'M117 126h66M117 126v7h66v-7M183 126l16-12v7l-16 12',
      'M116 134h66M116 134v7h66v-7M182 134l16-12v7l-16 12',
      'M124 121.5h52M123 129.5h52M122 137.5h52',
    ],
    hit: 'M110 100h96v46h-96z',
    label: { x: 158, y: 158, anchor: 'middle' },
  },
  archive: {
    lines: [
      'M222 96h50v40h-50z',
      'M222 116h50',
      'M228 98v16M235 98v16M243 98v16M229 118v16M238 118v16',
    ],
    hit: 'M216 90h62v52h-62z',
    label: { x: 247, y: 88, anchor: 'middle' },
  },
  write: {
    lines: ['M228 150l28-22 3 3-28 22h-3zM256 128l3-3 3 3-3 3M228 150l1-4'],
    hit: 'M222 122h44v34h-44z',
    label: { x: 262, y: 160, anchor: 'middle' },
  },
};

/** 机。物の下に 1 本、手前の縁にもう 1 本。 */
const DESK = 'M10 142h280M34 106h232M10 142l24-36M290 142l-24-36';

/**
 * 書斎の縮小図 — 手で描いた見取り図。
 *
 * 前の版は物を四角い札に並べていて、「ビジュアライズが超ダサい」と言われた。書斎（3D）の
 * 構図をそのまま線で写し、物ごとに当たりを持たせる。触れると灯り、押すと留まる。
 * 手描きに見せるのは、線をわずかに揺らす filter（feTurbulence → feDisplacementMap）。
 * 字は揺らさない。
 */
export function HelpStudyMap({
  parts,
  titles,
  active,
  pinned,
  onHover,
  onPress,
}: HelpStudyMapProps) {
  const filterId = useId();
  const drawn = parts.filter((part) => PIECES[part] !== undefined);

  return (
    <svg
      {...verifyAttrs({ unit: 'HelpStudyMap', parts: drawn.join(','), active: active ?? 'none' })}
      viewBox="0 0 300 190"
      className="block h-auto w-full"
      style={{ ...CONTROL_FONT, color: 'var(--date-color)' }}
      onPointerLeave={() => onHover(null)}
    >
      <title>{titles.get('study') ?? ''}</title>
      <defs>
        {/* 手描きの揺れ。線だけに掛ける（字には掛けない）。 */}
        <filter id={filterId} x="-2%" y="-2%" width="104%" height="104%">
          <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="7" />
          <feDisplacementMap
            in="SourceGraphic"
            scale="1.8"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter={`url(#${filterId})`}
      >
        <path d={DESK} opacity="0.6" />
      </g>
      {drawn.map((part) => {
        const piece = PIECES[part];
        if (!piece) return null;
        const lit = active === part;
        const title = titles.get(part) ?? part;
        return (
          // biome-ignore lint/a11y/useSemanticElements: SVG の中に button は置けない
          <g
            key={part}
            data-part={part}
            data-lit={lit ? '' : undefined}
            role="button"
            tabIndex={0}
            aria-label={title}
            aria-pressed={pinned === part}
            className="cursor-pointer outline-none"
            onPointerEnter={() => onHover(part)}
            onFocus={() => onHover(part)}
            onBlur={() => onHover(null)}
            onClick={() => onPress(part)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              onPress(part);
            }}
          >
            {/* 当たり。灯っているときだけ薄く塗る。 */}
            <path
              d={piece.hit}
              fill={lit ? 'color-mix(in srgb, var(--accent) 14%, transparent)' : 'transparent'}
              stroke="none"
              rx="6"
            />
            <g
              fill="none"
              stroke={lit ? 'var(--accent)' : 'currentColor'}
              strokeWidth={lit ? 1.8 : 1.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              filter={`url(#${filterId})`}
              className="transition-[stroke] duration-150"
            >
              {piece.lines.map((d) => (
                <path key={d} d={d} />
              ))}
            </g>
            <text
              x={piece.label.x}
              y={piece.label.y}
              textAnchor={piece.label.anchor}
              fontSize="9.5"
              letterSpacing="0.06em"
              fill={lit ? 'var(--fg)' : 'currentColor'}
              fontWeight={lit ? 500 : 400}
            >
              {title}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
