'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
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
const WORLD: Bounds = { x: 0, y: 0, width: 1440, height: 2300 };

/** 壜の大きさ（world）。初期表示（HOME を 390px に収めた倍率 ≈ 0.32）で画面幅の 6 割。 */
const BOTTLE = { width: 720, height: 900 } as const;

/**
 * 円の直径（world）。PC の 420 より小さい。
 *
 * SP では円の中に言葉やアイコンを並べない（縦画面で潰れて分からなくなる）ので、
 * 問いが 3 行で読める大きさで足りる。初期表示（下の HOME を 390px に収めた倍率 ≈ 0.32）
 * で画面上 110px 前後。寄れば大きく読める。
 */
const CIRCLE = 340;

/** 位置が無い問いの既定の席。壜（中央）を避けて上下左右に散らす。 */
const FALLBACK: readonly { x: number; y: number }[] = [
  { x: 78, y: 22 },
  { x: 22, y: 30 },
  { x: 80, y: 70 },
  { x: 20, y: 78 },
  { x: 50, y: 10 },
  { x: 50, y: 90 },
];

/**
 * 最初に見せる範囲。壜と、既定の席の円が全部入る縦長の窓。
 * 縁ぎりぎりに置かれた円へは指で寄り引きして行く。
 */
const HOME: Bounds = { x: 100, y: 120, width: 1240, height: 2060 };

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
        overlay={
          <div data-canvas-no-pan="">
            <CanvasZoomControls
              scale={canvas.viewport.scale}
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
              className="absolute flex items-center justify-center rounded-full text-center"
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
                className="block px-8"
                style={{
                  fontFamily: "'Noto Serif JP', serif",
                  fontSize: 40,
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
              {question.hasLetter ? (
                <span
                  aria-hidden="true"
                  data-letter-mark
                  className="absolute flex items-center justify-center rounded-full"
                  style={{
                    right: 18,
                    bottom: 18,
                    width: 72,
                    height: 72,
                    background: question.unread
                      ? 'linear-gradient(135deg, #FFFFFF, #FBF1EE)'
                      : 'rgba(253,251,247,0.9)',
                    border: `3px solid rgba(122,59,63,${question.unread ? 0.5 : 0.25})`,
                  }}
                >
                  <svg
                    aria-hidden="true"
                    width="34"
                    height="34"
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
                </span>
              ) : null}
            </button>
          );
        })}
      </CanvasViewport>
    </div>
  );
}
