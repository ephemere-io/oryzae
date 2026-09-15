'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { CanvasGrid } from '@/components/ui/canvas-grid';
import { CanvasViewport } from '@/components/ui/canvas-viewport';
import { CanvasZoomControls } from '@/components/ui/canvas-zoom-controls';
import { JarBottle } from '@/features/shared/fermentation/components/jar-bottle';
import { useCanvasViewport } from '@/lib/canvas/use-canvas-viewport';
import type { Bounds } from '@/lib/canvas/viewport';

export interface MapQuestion {
  id: string;
  /** 円の中に書く問い。無題でも空にしない（呼び出し側が既定文言を入れる）。 */
  text: string;
  /** 世界の中の位置（0–100%）。無ければ既定の席。 */
  jarX: number | null;
  jarY: number | null;
  /** 完了した発酵（手紙）が届いているか。 */
  hasLetter: boolean;
  /** その手紙がまだ読まれていないか。 */
  unread: boolean;
}

interface SpJarMapProps {
  questions: MapQuestion[];
  onSelect: (questionId: string) => void;
  /** 円を掴んで置き直したとき（世界の 0–100%）。無ければ動かせない。 */
  onMove?: (questionId: string, position: { jarX: number; jarY: number }) => void;
}

/**
 * 瓶の世界の大きさ（world 単位）。**縦画面なので縦長**。
 *
 * 以前は PC と同じ横長の箱（2300×1440）だった。縦画面では世界の幅で倍率が決まるので
 * 壜が画面幅の 1/4 にしかならず「小さすぎる」と言われた。DB の 0–100 の座標は
 * 「箱の %」なので、箱の比が変わっても右上の円は右上に居る（PC と同じ側に同じ順で並ぶ）。
 */
const WORLD: Bounds = { x: 0, y: 0, width: 1440, height: 2700 };

/**
 * 壜の大きさ（world）。初期表示（HOME を 390×739 に収めた倍率 ≈ 0.28）で箱が画面幅の 7 割、
 * 硝子の見た目（箱より細い）で 45% ほど。720×900 では硝子が 36% で、まだ「小さい」と見えた。
 * 比は `JarBottle` の viewBox（480:600）に合わせる。
 */
const BOTTLE = { width: 960, height: 1200 } as const;

/**
 * 円の直径（world）。
 *
 * SP では円の中に言葉やアイコンを並べない（縦画面で潰れて分からなくなる）ので、問いの 3 行と
 * 手紙の印が入る大きさ。480 では問いと印が詰まって見え、「円をもう少し大きく」と言われた（実機レビュー）。
 */
const CIRCLE = 560;

/**
 * 位置が無い問いの既定の席。壜（中央、y 28〜72%）を避けて上下左右に散らす。
 * 上の 2 つは壜の口より上、下の 2 つは底より下（円の半径 = 世界の高さの 10% ほどを見込む）。
 */
const FALLBACK: readonly { x: number; y: number }[] = [
  { x: 78, y: 15 },
  { x: 22, y: 20 },
  { x: 80, y: 84 },
  { x: 22, y: 88 },
  { x: 50, y: 8 },
  { x: 50, y: 92 },
];

/**
 * 最初に見せる範囲。壜と、既定の席の円が全部入る縦長の窓。
 * 縁ぎりぎりに置かれた円へは指で寄り引きして行く。
 */
const HOME: Bounds = { x: 40, y: 40, width: 1360, height: 2560 };

/**
 * 方眼の目（world）。SP の瓶は PC より引いて見る（100% で PC の瓶の初期表示の半分ほどの倍率）ので、
 * PC と同じ 40 では画面上の目が 8px に詰まって灰色の面に見える。PC の瓶と同じ目の細かさに揃える。
 */
const GRID = 100;

/** これ以上動いたらタップではなく掴んで動かす（px）。 */
const TAP_SLOP = 8;

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value * 10) / 10));
}

/**
 * SP の瓶の「地図」。**PC と同じ構造**: 中央に壜、まわりにシャーレ（問いの円）、
 * 指でピンチして寄り引き、空白をドラッグしてパン（`useCanvasViewport`）。
 *
 * 以前は壜のまわりを円が自走で回っていたが、「回る必要性が分からない」「PC の 2D の
 * 地図を踏襲してほしい」と言われた。SP の違いは**円の中に中身を並べないこと**だけ。
 * 円は小さく、問いだけを書く。押した先（`SpQuestionZoom`）で手紙・言葉・抜粋を読む。
 */
export function SpJarMap({ questions, onSelect, onMove }: SpJarMapProps) {
  const t = useTranslations('sp.jar');
  /**
   * 掴んで動かした円の位置（%）。取得し直すまでの間、こちらを優先する。
   * 保存は離したときに親へ渡す（PC と同じく、保存は debounce つき）。
   */
  const [moved, setMoved] = useState<Record<string, { jarX: number; jarY: number }>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragRef = useRef<{
    id: string;
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    active: boolean;
  } | null>(null);
  const canvas = useCanvasViewport({
    // 倍率と位置は持ち越さない。開くたびに壜と円が全部入る HOME に収める（ボードと同じ「開いた直後は全体」）。
    defaultFitBounds: HOME,
    // 「100%」は壜とまわりの円が収まる姿。PC の「world 1 = 1px」を使うと、100% で壜が画面いっぱいに
    // なった（実機レビュー）。
    referenceBounds: HOME,
    fitPadding: 16,
    // 「全体」は HOME（壜と既定の席の円が入る窓）。殻の高さが測り直されて frame が変わると hook が
    // ここへ収め直すので、世界全体（WORLD）を返すと壜が小さくなる。
    getContentBounds: () => HOME,
  });
  const pointerRef = useRef<{ x: number; y: number } | null>(null);

  return (
    <div
      className="relative h-full w-full"
      {...verifyAttrs({ unit: 'SpJarMap', count: questions.length })}
    >
      <CanvasViewport
        canvas={canvas}
        ariaLabel={t('map_aria')}
        style={{ backgroundColor: 'var(--bg)' }}
        // 模造紙の方眼（PC の瓶と同じ色）。frame に敷き、world に貼り付いて見える。
        background={<CanvasGrid canvas={canvas} size={GRID} color="rgba(140,133,126,0.07)" />}
        overlay={
          <div data-canvas-no-pan="">
            <CanvasZoomControls
              scale={canvas.viewport.scale}
              referenceScale={canvas.referenceScale}
              onZoomIn={canvas.zoomIn}
              onZoomOut={canvas.zoomOut}
              onReset={canvas.resetZoom}
              onFit={() => canvas.fitTo(HOME)}
            />
          </div>
        }
      >
        {/* 壜。世界の中央。 */}
        <div
          className="pointer-events-none absolute"
          style={{
            left: (WORLD.width - BOTTLE.width) / 2,
            top: (WORLD.height - BOTTLE.height) / 2,
            width: BOTTLE.width,
            height: BOTTLE.height,
          }}
        >
          <JarBottle />
        </div>

        {questions.map((question, index) => {
          const fallback = FALLBACK[index % FALLBACK.length] ?? FALLBACK[0];
          const placed = moved[question.id];
          const percentX = placed?.jarX ?? question.jarX ?? fallback.x;
          const percentY = placed?.jarY ?? question.jarY ?? fallback.y;
          const x = (percentX / 100) * WORLD.width;
          const y = (percentY / 100) * WORLD.height;
          const dragging = draggingId === question.id;
          return (
            <button
              key={question.id}
              type="button"
              aria-label={question.text}
              data-question-id={question.id}
              // 円の上で始まった指はパンにしない（hook はこの印で辞退する）。
              data-canvas-no-pan=""
              onPointerDown={(event) => {
                pointerRef.current = { x: event.clientX, y: event.clientY };
                if (!onMove) return;
                dragRef.current = {
                  id: question.id,
                  pointerId: event.pointerId,
                  startX: event.clientX,
                  startY: event.clientY,
                  originX: x,
                  originY: y,
                  active: false,
                };
              }}
              // 掴んで動かす。スロップを越えたら円が指に付いてくる（PC のシャーレと同じ）。
              onPointerMove={(event) => {
                const drag = dragRef.current;
                if (!drag || drag.pointerId !== event.pointerId) return;
                const dx = event.clientX - drag.startX;
                const dy = event.clientY - drag.startY;
                if (!drag.active) {
                  if (Math.abs(dx) + Math.abs(dy) <= TAP_SLOP) return;
                  drag.active = true;
                  try {
                    event.currentTarget.setPointerCapture(event.pointerId);
                  } catch {
                    // 既に離れた指や合成イベントでは NotFoundError になる。掴めなくても動きは追える。
                  }
                  setDraggingId(drag.id);
                }
                const scale = canvas.viewport.scale || 1;
                const worldX = drag.originX + dx / scale;
                const worldY = drag.originY + dy / scale;
                setMoved((previous) => ({
                  ...previous,
                  [drag.id]: {
                    jarX: clampPercent((worldX / WORLD.width) * 100),
                    jarY: clampPercent((worldY / WORLD.height) * 100),
                  },
                }));
              }}
              onPointerUp={(event) => {
                const drag = dragRef.current;
                if (!drag || drag.pointerId !== event.pointerId) return;
                dragRef.current = null;
                if (!drag.active) return;
                setDraggingId(null);
                const position = moved[drag.id];
                if (position && onMove) onMove(drag.id, position);
              }}
              onPointerCancel={() => {
                dragRef.current = null;
                setDraggingId(null);
              }}
              onClick={(event) => {
                // 指が動いていたらピンチ／パンの余韻。開かない。
                const start = pointerRef.current;
                pointerRef.current = null;
                if (
                  start &&
                  Math.abs(event.clientX - start.x) + Math.abs(event.clientY - start.y) > TAP_SLOP
                ) {
                  return;
                }
                onSelect(question.id);
              }}
              // 問いの文字と手紙の印を**ひとかたまり**にして、そのかたまりの中心を円の中心に置く（grid の
              // place-items）。印を円の下端に絶対配置していた頃は下に寄り、字と印の間も詰まって見えた（実機レビュー）。
              className="absolute grid place-items-center rounded-full text-center"
              style={{
                left: x - CIRCLE / 2,
                top: y - CIRCLE / 2,
                width: CIRCLE,
                height: CIRCLE,
                // 壜と同じ紙と麹の色（PC の壜の `rgba(226,194,142)`）。以前は縁と字がえんじ色で、
                // 壜と同じ画面の物に見えなかった（実機レビュー）。
                background:
                  'radial-gradient(circle at 50% 42%, rgba(255,255,255,0.9), rgba(253,251,247,0.6))',
                border: `${question.unread ? 4 : 2}px solid rgba(226,194,142,${
                  question.unread ? 1 : 0.7
                })`,
                boxShadow: dragging
                  ? '0 0 0 12px rgba(226,194,142,0.18), 0 32px 70px rgba(140,133,126,0.28)'
                  : question.unread
                    ? '0 0 0 18px rgba(226,194,142,0.16), 0 24px 60px rgba(140,133,126,0.16)'
                    : '0 18px 50px rgba(140,133,126,0.12)',
                transform: dragging ? 'scale(1.04)' : undefined,
                transition: dragging ? 'none' : 'box-shadow 200ms ease, transform 200ms ease',
                zIndex: dragging ? 2 : undefined,
                touchAction: 'none',
              }}
            >
              <span
                data-circle-content
                // 幅は円の直径に対する割合で決める（円の大きさを変えても字の入り方が変わらない）。印と縦に
                // 並ぶときは、かたまりの上下が円の狭いところに掛かるので細くする。字と印の間は字の高さで取る。
                className="flex flex-col items-center"
                style={{ width: question.hasLetter ? '74%' : '80%', gap: '0.9em', fontSize: 48 }}
              >
                <span
                  className="block"
                  style={{
                    fontFamily: "'Noto Serif JP', serif",
                    lineHeight: 1.35,
                    color: 'var(--fg)',
                    opacity: 0.85,
                    letterSpacing: '0.04em',
                    display: '-webkit-box',
                    WebkitBoxOrient: 'vertical',
                    WebkitLineClamp: 3,
                    overflow: 'hidden',
                  }}
                >
                  {question.text}
                </span>
                {/* 手紙の印は言葉で（「手紙が届いています」は問いの一覧を開かないと見えなかった）。
                  未読なら「新しい手紙」、読んだら「手紙」。問いの文字のすぐ下。 */}
                {question.hasLetter ? (
                  <span
                    aria-hidden="true"
                    data-letter-mark
                    className="flex shrink-0 items-center justify-center gap-3 rounded-full"
                    style={{
                      height: 96,
                      padding: '0 36px 0 28px',
                      fontFamily: 'Inter, "Noto Sans JP", sans-serif',
                      fontSize: 44,
                      letterSpacing: '0.04em',
                      whiteSpace: 'nowrap',
                      color: '#7A3B3F',
                      background: question.unread
                        ? 'linear-gradient(135deg, #FFFFFF, #FBF1EE)'
                        : 'rgba(253,251,247,0.9)',
                      border: `3px solid rgba(122,59,63,${question.unread ? 0.5 : 0.25})`,
                      opacity: question.unread ? 1 : 0.7,
                    }}
                  >
                    <svg
                      aria-hidden="true"
                      width="50"
                      height="50"
                      viewBox="0 0 16 16"
                      fill="none"
                      style={{ color: '#7A3B3F', opacity: question.unread ? 1 : 0.55 }}
                    >
                      <path
                        d="M1 4L8 9L15 4"
                        stroke="currentColor"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M1 4V12H15V4"
                        stroke="currentColor"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {question.unread ? t('letter_badge_unread') : t('letter_badge')}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </CanvasViewport>
    </div>
  );
}
