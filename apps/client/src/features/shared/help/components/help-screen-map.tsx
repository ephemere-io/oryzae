'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useId } from 'react';
import { CONTROL_FONT } from '@/components/ui/surface';
import type { HelpTopicId } from '../types';

export interface HelpScreenMapProps {
  /** どの画面の見取り図か。`hasScreenDrawing` が true のものだけ描ける。 */
  screen: HelpTopicId;
  /** 画面の部品（描く物）。図に無い id は描かない。 */
  parts: readonly HelpTopicId[];
  /** 札の字。書斎は部屋の注釈（JAR / ENTRIES / …）、他は画面に出ている名前。 */
  labels: ReadonlyMap<HelpTopicId, string>;
  /** 図の題（読み上げ用）。 */
  title: string;
  /** 灯っている物。 */
  active: HelpTopicId | null;
  /** 留めてある物（押した）。 */
  pinned: HelpTopicId | null;
  onHover: (part: HelpTopicId | null) => void;
  onPress: (part: HelpTopicId) => void;
}

/**
 * 物ごとの線と、当たりと、札の位置。座標は 300 × 190 の箱。
 * 線は書斎の物と同じ 1 本の線で、面も影も塗らない。
 */
interface Piece {
  /** 見える線。 */
  lines: readonly string[];
  /** 当たり（見えない面）。線より少し大きい。 */
  hit: string;
  /** 札の位置と寄せ。 */
  label: { x: number; y: number; anchor: 'start' | 'middle' | 'end' };
}

interface Drawing {
  /** 舞台（机・瓶の外形・紙 …）。触れられない。 */
  frame: readonly string[];
  pieces: Partial<Record<HelpTopicId, Piece>>;
}

/**
 * 画面ごとの見取り図。どれも実際の画面の構図をそのまま線で写す。
 *
 * - 書斎: 手前に机、奥の壁に板、机の左に瓶、真ん中に手帳の束、右奥に書庫、手前右に鉛筆
 * - 瓶: 大きな瓶の中に問いの円、右上に「問いの変遷」、円の脇に手紙、下に現在の問いのチップ
 * - 書く: 縦書きの行が右から並ぶ。左上に「問いを紐づける」のチップ、下の真ん中に浮くパレット
 *   （漬け込む）、選んだ行（スニペット）
 * - ボード: 板にカード（スニペット）と写真、下端の中央に道具箱。どちらも触れられる
 * - 一覧: 月の見出しと行。上が今月の手帳、下が過去の月（書庫）
 * - 問いの変遷: 左に縦の年表（日付の点）、右に問いのカード
 */
const DRAWINGS: Partial<Record<HelpTopicId, Drawing>> = {
  study: {
    frame: ['M10 142h280M34 106h232M10 142l24-36M290 142l-24-36'],
    pieces: {
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
    },
  },
  jar: {
    frame: [
      'M120 32h60v8h-60z',
      'M116 40c-22 20-26 62-10 100h88c16-38 12-80-10-100z',
      'M92 164h34v10H92zM132 164h40v10h-40zM178 164h34v10h-34z',
    ],
    pieces: {
      question: {
        lines: [
          'M150 96m-16 0a16 16 0 1 0 32 0a16 16 0 1 0-32 0',
          'M124 122m-11 0a11 11 0 1 0 22 0a11 11 0 1 0-22 0',
          'M178 118m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0',
        ],
        hit: 'M106 74h88v66h-88z',
        label: { x: 150, y: 68, anchor: 'middle' },
      },
      letter: {
        lines: ['M198 80h24v15h-24zM198 80l12 9 12-9'],
        hit: 'M192 72h36v30h-36z',
        label: { x: 236, y: 112, anchor: 'start' },
      },
      questions: {
        lines: ['M226 20h56v14h-56zM234 27h8M248 27h28'],
        hit: 'M220 14h68v26h-68z',
        label: { x: 254, y: 48, anchor: 'middle' },
      },
    },
  },
  // 書く: 既定は縦書き。右から左へ行が並び、左上に「‹ 書斎」と「問いを紐づける」のチップ、
  // 右上に日付、下の真ん中にパレットが浮く。
  write: {
    frame: ['M36 22h24v13H36z', 'M226 20h36', 'M236 32v48M218 36v120M200 36v100M182 36v96'],
    pieces: {
      question: {
        lines: ['M68 22h64v13H68zM75 28.5h6M78 25.5v6'],
        hit: 'M62 16h76v25H62z',
        label: { x: 100, y: 50, anchor: 'middle' },
      },
      pickle: {
        lines: [
          'M104 146h92v18h-92z',
          'M112 151h8v8h-8zM126 151h8v8h-8zM140 151h8v8h-8zM154 151h8v8h-8zM168 151h8v8h-8zM182 151h8v8h-8z',
        ],
        hit: 'M98 140h104v30H98z',
        label: { x: 150, y: 180, anchor: 'middle' },
      },
      snippet: {
        lines: ['M182 76v32', 'M177 76h10M177 108h10'],
        hit: 'M172 70h20v44h-20z',
        label: { x: 168, y: 96, anchor: 'end' },
      },
    },
  },
  board: {
    frame: ['M30 30h240v130H30z', 'M120 168h60v12h-60z'],
    pieces: {
      // 貼った写真。前は舞台の線で、札も当たりも無く「何の四角か分からない」と言われた。
      photo: {
        lines: [
          'M160 70h80v46h-80z',
          'M168 108l18-16 14 10 12-8 20 14',
          'M224 82m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0',
        ],
        hit: 'M154 64h92v58h-92z',
        label: { x: 200, y: 134, anchor: 'middle' },
      },
      snippet: {
        lines: ['M64 56h70v40H64z', 'M72 66h50M72 74h40M72 82h46'],
        hit: 'M58 50h82v52H58z',
        label: { x: 99, y: 114, anchor: 'middle' },
      },
    },
  },
  list: {
    frame: ['M40 40h220M40 64h220M40 88h220', 'M40 124h220M40 148h220', 'M40 30h60M40 114h60'],
    pieces: {
      notebook: {
        lines: ['M48 52h120M48 76h90'],
        hit: 'M34 26h232v66H34z',
        label: { x: 262, y: 56, anchor: 'end' },
      },
      archive: {
        lines: ['M48 136h100M48 160h80'],
        hit: 'M34 110h232v62H34z',
        label: { x: 262, y: 140, anchor: 'end' },
      },
    },
  },
  // 問いの変遷: 上に「新しい問いを追加」の欄、左に縦の年表（日付の点）、右に問いのカード。
  questions: {
    frame: [
      'M60 20h148v14H60zM216 20h30v14h-30z',
      'M48 50v130',
      'M48 62m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0M48 136m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0',
      'M58 62h30M58 136h30',
    ],
    pieces: {
      question: {
        lines: [
          'M62 72h180v20H62zM62 98h180v20H62zM62 146h180v20H62z',
          'M74 82h56M74 108h76M74 156h44',
        ],
        hit: 'M56 66h192v106H56z',
        label: { x: 152, y: 184, anchor: 'middle' },
      },
    },
  },
};

export function hasScreenDrawing(screen: HelpTopicId): boolean {
  return DRAWINGS[screen] !== undefined;
}

/**
 * 画面の見取り図 — 手で描いた図。
 *
 * 部品を四角い札に並べた版は「ビジュアライズが超ダサい」と言われた。画面の構図をそのまま
 * 線で写し、物ごとに当たりを持たせる。触れると灯り、押すと留まる。手描きに見せるのは、
 * 線をわずかに揺らす filter（feTurbulence → feDisplacementMap）。字は揺らさない。
 */
export function HelpScreenMap({
  screen,
  parts,
  labels,
  title,
  active,
  pinned,
  onHover,
  onPress,
}: HelpScreenMapProps) {
  const filterId = useId();
  const drawing = DRAWINGS[screen];
  const drawn = parts.filter((part) => drawing?.pieces[part] !== undefined);
  if (!drawing) return null;

  return (
    <svg
      {...verifyAttrs({
        unit: 'HelpScreenMap',
        screen,
        parts: drawn.length === 0 ? 'none' : drawn.join(','),
        active: active ?? 'none',
      })}
      viewBox="0 0 300 190"
      className="block h-auto w-full"
      style={{ ...CONTROL_FONT, color: 'var(--date-color)' }}
      onPointerLeave={() => onHover(null)}
    >
      <title>{title}</title>
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
        opacity="0.6"
      >
        {drawing.frame.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      {drawn.map((part) => {
        const piece = drawing.pieces[part];
        if (!piece) return null;
        const lit = active === part;
        const label = labels.get(part) ?? part;
        return (
          // biome-ignore lint/a11y/useSemanticElements: SVG の中に button は置けない
          <g
            key={part}
            data-part={part}
            data-lit={lit ? '' : undefined}
            role="button"
            tabIndex={0}
            aria-label={label}
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
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
