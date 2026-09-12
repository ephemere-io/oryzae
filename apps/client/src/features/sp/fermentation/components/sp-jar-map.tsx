'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { useRef } from 'react';
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
}

/**
 * 瓶の世界の大きさ（world 単位）。**PC と同じ箱**にする。
 *
 * DB の 0–100 の座標が「この箱の %」であることは端末で変わらない。同じ箱にしておけば、
 * PC で動かした円が SP でも同じ場所に居る。
 */
const WORLD: Bounds = { x: 0, y: 0, width: 2300, height: 1440 };

/** 壜の大きさ（world）。PC の `JarVessel` と同じ。 */
const BOTTLE = { width: 500, height: 620 } as const;

/**
 * 円の直径（world）。PC の 420 より小さい。
 *
 * SP では円の中に言葉やアイコンを並べない（縦画面で潰れて分からなくなる）ので、
 * 問いが 3 行で読める大きさで足りる。初期表示（下の HOME を 390px に収めた倍率 ≈ 0.26）
 * で画面上 90px 前後。寄れば大きく読める。
 */
const CIRCLE = 340;

/** 位置が無い問いの既定の席（PC と同じ）。 */
const FALLBACK: readonly { x: number; y: number }[] = [
  { x: 80, y: 22 },
  { x: 72, y: 72 },
  { x: 14, y: 46 },
];

/**
 * 最初に見せる範囲。世界全体（2300 幅）を 390px に収めると壜が 80px にしかならないので、
 * 中央の 1500×1040 を収める。外にある円へは指で寄り引きして行く。
 */
const HOME: Bounds = { x: 400, y: 200, width: 1500, height: 1040 };

/** これ以上動いたらタップではなくパン／ピンチ（px）。 */
const TAP_SLOP = 8;

/**
 * SP の瓶の「地図」。**PC と同じ構造**: 中央に壜、まわりにシャーレ（問いの円）、
 * 指でピンチして寄り引き、空白をドラッグしてパン（`useCanvasViewport`）。
 *
 * 以前は壜のまわりを円が自走で回っていたが、「回る必要性が分からない」「PC の 2D の
 * 地図を踏襲してほしい」と言われた。SP の違いは**円の中に中身を並べないこと**だけ。
 * 円は小さく、問いだけを書く。押した先（`SpQuestionZoom`）で手紙・言葉・抜粋を読む。
 */
export function SpJarMap({ questions, onSelect }: SpJarMapProps) {
  const t = useTranslations('sp.jar');
  const canvas = useCanvasViewport({
    storageKey: 'jar-sp',
    defaultFitBounds: HOME,
    fitPadding: 16,
    getContentBounds: () => WORLD,
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
          const x = ((question.jarX ?? fallback.x) / 100) * WORLD.width;
          const y = ((question.jarY ?? fallback.y) / 100) * WORLD.height;
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
                background:
                  'radial-gradient(circle at 50% 45%, rgba(253,251,247,0.92), rgba(253,251,247,0.55))',
                border: `${question.unread ? 4 : 2}px solid ${
                  question.unread ? 'rgba(122,59,63,0.55)' : 'rgba(226,194,142,0.7)'
                }`,
                boxShadow: question.unread
                  ? '0 0 0 18px rgba(217,180,143,0.16), 0 24px 60px rgba(140,133,126,0.16)'
                  : '0 18px 50px rgba(140,133,126,0.12)',
                touchAction: 'none',
              }}
            >
              <span
                className="block px-8"
                style={{
                  fontFamily: "'Noto Serif JP', serif",
                  fontSize: 40,
                  lineHeight: 1.35,
                  color: '#7A3B3F',
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
