'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useCallback, useEffect, useRef, useState } from 'react';
import { JarBottle } from '@/features/shared/fermentation/components/jar-bottle';
import {
  clampSpin,
  decaySpin,
  dragToSpin,
  frontIndex,
  IDLE_SPIN,
  orbitSlot,
} from '@/features/sp/fermentation/orbit';
import { fitRingText, RING_TRACKING, ringPath } from '@/features/sp/fermentation/ring-text';
import { ringSlots } from '@/features/sp/fermentation/zoom-layout';

export interface OrbitQuestion {
  id: string;
  /** 円周に回す問いの文言。無題でも空にしない（呼び出し側が既定文言を入れる）。 */
  text: string;
  /** 完了した発酵（手紙）が届いているか。 */
  hasLetter: boolean;
  /** その手紙がまだ読まれていないか。 */
  unread: boolean;
  /** 円の中に浮かべる言葉。**開く前から中身が見えている**ことがこの円の役目。 */
  keywords: string[];
  /** 抜粋の数。中身は開いてから読むので、ここでは「何枚あるか」だけを示す。 */
  snippetCount: number;
}

interface SpJarOrbitProps {
  questions: OrbitQuestion[];
  onSelect: (questionId: string) => void;
}

/** 軌道の中心（コンテナに対する %）。壜の胴の高さに合わせてある。 */
const CENTER_X = 50;
const CENTER_Y = 52;

/** 軌道の横半径（コンテナ幅に対する比）。円がはみ出さない範囲でいちばん広く。 */
const RADIUS_X_RATIO = 0.36;
/**
 * 軌道の縦半径（px）。輪を真横から見ず、少し上から見た角度にする。
 *
 * ここが小さいと手前の円が壜の胴の真ん中に重なり、壜が読めなくなる。手前は壜の裾、
 * 奥は壜の首、と縦にずらすことで「まわりを回っている」ように見せる。
 */
const RADIUS_Y = 76;

/**
 * 手前の円の直径（px）。画面幅に比例させつつ、大きくなりすぎないよう頭を打つ。
 *
 * 中央に壜が居るので、円が大きすぎると壜を飲み込む。問いが読める下限（ring-text の
 * 12px）と、壜が見える上限のあいだを取る。
 */
const CIRCLE_RATIO = 0.44;
const CIRCLE_MAX = 176;
const CIRCLE_MIN = 128;

/** 壜の重なり順。奥の円（z<500）より手前、手前の円（z>500）より奥。 */
const JAR_Z = 500;

/** これ以上動いたらタップではなく回した、とみなす（px）。 */
const TAP_SLOP = 8;

/**
 * 円の中に出す中身の上限。
 *
 * 小さな円なので、全部は入らない。**在ることが伝わればよい**ので数を絞る
 * （読むのは開いてからで、円の中はその予告）。
 */
const PREVIEW_KEYWORDS = 3;
const PREVIEW_SNIPPETS = 3;

/** 中身を置く輪の半径（円の直径に対する %）。外周のリング文字とぶつからない内側。 */
const PREVIEW_KEYWORD_RADIUS = 30;
const PREVIEW_SNIPPET_RADIUS = 39;

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function circleSize(width: number): number {
  if (width <= 0) return CIRCLE_MIN;
  return Math.round(Math.min(CIRCLE_MAX, Math.max(CIRCLE_MIN, width * CIRCLE_RATIO)));
}

/**
 * 壜を中央に置き、その周りを問いの円が回る SP の瓶（presentational）。
 *
 * 回転は **React の state ではなく DOM の style を直接書いて** 進める。問いは最大でも
 * 数件だが、60fps で state を回すと円の中の SVG まで毎フレーム差分計算に乗る。
 * ここで React に渡すのは「正面がどれか」だけ（数秒に一度しか変わらない）。
 *
 * 指で横に払うと回転が速くなり、離すと既定の速さへ戻る（止まらない）。
 * `prefers-reduced-motion` のときは自走せず、指で回したぶんだけ動く。
 */
export function SpJarOrbit({ questions, onSelect }: SpJarOrbitProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef(new Map<string, HTMLElement>());
  const angleRef = useRef(0);
  const velocityRef = useRef(IDLE_SPIN);
  const draggingRef = useRef(false);
  /**
   * 直前の指離しが「回した」だったか。
   *
   * click は pointerup の**後**に来るので、pointerup で dragging を降ろしてしまうと、
   * 回し終えて指を離した場所の円が開いてしまう。回したかどうかを次の click まで持ち越す。
   */
  const draggedRef = useRef(false);
  const pointerRef = useRef<{ id: number; x: number; y: number; moved: number } | null>(null);

  const [width, setWidth] = useState(0);
  const [frontId, setFrontId] = useState<string | null>(null);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setReduced(prefersReducedMotion());
  }, []);

  // 自走しない設定では、触るまで止まっているのが正しい（勝手に動くものを避ける設定なので）。
  useEffect(() => {
    if (reduced) velocityRef.current = 0;
  }, [reduced]);

  // 円の直径と軌道半径は幅から決まる。幅は回転ではなく回転の「器」なので state でよい。
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setWidth(el.getBoundingClientRect().width);
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const count = questions.length;

  /** いまの角度を DOM に反映する。rAF から毎フレーム呼ぶ。 */
  const apply = useCallback(() => {
    const radiusX = width * RADIUS_X_RATIO;
    questions.forEach((question, index) => {
      const el = itemRefs.current.get(question.id);
      if (!el) return;
      const slot = orbitSlot(index, count, angleRef.current);
      el.style.transform = `translate3d(${slot.x * radiusX}px, ${slot.depth * RADIUS_Y}px, 0) scale(${slot.scale})`;
      el.style.opacity = String(slot.opacity);
      el.style.zIndex = String(slot.z);
    });
    const front = frontIndex(count, angleRef.current);
    const id = front >= 0 ? (questions[front]?.id ?? null) : null;
    setFrontId((current) => (current === id ? current : id));
  }, [questions, count, width]);

  useEffect(() => {
    if (count === 0) return;
    let frame = 0;
    let last = 0;
    const tick = (now: number) => {
      const deltaSeconds = last === 0 ? 0 : Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!draggingRef.current && deltaSeconds > 0) {
        // 自走しない設定では減衰の行き先（IDLE_SPIN）も 0 なので、そのまま止まる。
        velocityRef.current = reduced
          ? velocityRef.current * 0.88
          : decaySpin(velocityRef.current, deltaSeconds);
        angleRef.current += velocityRef.current * deltaSeconds;
      }
      apply();
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [apply, count, reduced]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    draggedRef.current = false;
    pointerRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: 0 };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const pointer = pointerRef.current;
    if (!pointer || pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.x;
    pointer.moved += Math.abs(dx) + Math.abs(event.clientY - pointer.y);
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    if (pointer.moved < TAP_SLOP) return;

    draggingRef.current = true;
    draggedRef.current = true;
    // 指の動きは角度そのものに足す（追従が一番気持ちいい）。速さは離したあとの惰性に使う。
    const delta = dragToSpin(dx, width);
    angleRef.current += delta;
    velocityRef.current = clampSpin(delta * 60);
  };

  const endPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const pointer = pointerRef.current;
    if (!pointer || pointer.id !== event.pointerId) return;
    pointerRef.current = null;
    draggingRef.current = false;
  };

  const size = circleSize(width);

  return (
    <div
      ref={containerRef}
      // 縦積みの中で余った高さを全部もらう。`h-full` だと親（flex 列）の高さが
      // 確定していないぶん 0 になり、壜も円も潰れて見えなくなる。
      className="relative min-h-0 w-full flex-1 overflow-hidden"
      style={{
        // 縦にスクロールする中身が無いので、縦横どちらの指も回転に使う。
        touchAction: 'none',
        // 円の重なり順（奥行きを表す 0..1000）を**この中だけ**で閉じる。これが無いと
        // 手前の円の z-index:1000 が外の層（開いた円 z-20・シート z-30）を突き抜けて、
        // 開いた画面の上に軌道が浮いて見える。
        isolation: 'isolate',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      {...verifyAttrs({
        unit: 'SpJarOrbit',
        count,
        frontId: frontId ?? 'none',
        circleSize: size,
        reducedMotion: reduced,
      })}
    >
      {/* 壜。位置と大きさはここが決め、絵そのものは shared が持つ（PC と同じ壜）。 */}
      <div
        className="pointer-events-none absolute"
        style={{
          left: `${CENTER_X}%`,
          // 壜は軌道の中心より少し上に置く。裾を手前の円に隠されすぎないように。
          top: `${CENTER_Y - 5}%`,
          transform: 'translate(-50%, -50%)',
          width: '62%',
          height: '68%',
          zIndex: JAR_Z,
        }}
      >
        <JarBottle />
      </div>

      {/* 問いの円。位置・大きさ・濃さは rAF が直接書き込む。 */}
      {questions.map((question) => (
        <OrbitCircle
          key={question.id}
          question={question}
          size={size}
          reduced={reduced}
          registerRef={(el) => {
            if (el) itemRefs.current.set(question.id, el);
            else itemRefs.current.delete(question.id);
          }}
          onSelect={() => {
            // 回した直後の click は「開く」ではない。次のタップのために印を戻す。
            if (draggedRef.current) {
              draggedRef.current = false;
              return;
            }
            onSelect(question.id);
          }}
        />
      ))}
    </div>
  );
}

interface OrbitCircleProps {
  question: OrbitQuestion;
  size: number;
  reduced: boolean;
  registerRef: (el: HTMLElement | null) => void;
  onSelect: () => void;
}

function OrbitCircle({ question, size, reduced, registerRef, onSelect }: OrbitCircleProps) {
  const ring = fitRingText(question.text, size);
  const pathId = `sp-ring-${question.id}`;

  return (
    <button
      ref={registerRef}
      type="button"
      onClick={onSelect}
      aria-label={question.text}
      className="absolute rounded-full"
      style={{
        left: `${CENTER_X}%`,
        top: `${CENTER_Y}%`,
        width: `${size}px`,
        height: `${size}px`,
        marginLeft: `${-size / 2}px`,
        marginTop: `${-size / 2}px`,
        willChange: 'transform, opacity',
        // 初期値。以後は rAF が上書きする（ここが無いと1フレーム中央で重なる）。
        transform: 'translate3d(0,0,0)',
        background:
          'radial-gradient(circle at 50% 45%, rgba(253,251,247,0.55), rgba(253,251,247,0))',
        border: '1px solid rgba(226,194,142,0.45)',
        boxShadow: question.unread
          ? '0 0 0 5px rgba(217,180,143,0.16), 0 6px 20px rgba(140,133,126,0.14)'
          : '0 4px 16px rgba(140,133,126,0.10)',
        touchAction: 'none',
      }}
      data-question-id={question.id}
    >
      {/* 外周を回る問いテキスト。長い問いは輪が外へ増える（円の中は予告の席）。 */}
      <span
        className="pointer-events-none absolute inset-0 block"
        style={reduced ? undefined : { animation: 'sp-orbit-ring 150s linear infinite' }}
      >
        {/* 輪は円より大きくなりうるので、svg は inset-0 ではなく中心合わせで置く。
            transform を使うと回転アニメーションと取り合いになるので margin で寄せる。 */}
        <svg
          aria-hidden="true"
          viewBox={`0 0 ${ring.box} ${ring.box}`}
          className="absolute"
          style={{
            left: '50%',
            top: '50%',
            width: `${ring.box}px`,
            height: `${ring.box}px`,
            marginLeft: `${-ring.box / 2}px`,
            marginTop: `${-ring.box / 2}px`,
          }}
        >
          {ring.lines.map((line) => (
            <g key={line.radius}>
              <path
                id={`${pathId}-${Math.round(line.radius)}`}
                d={ringPath(ring.box / 2, line.radius)}
                fill="transparent"
              />
              <text
                style={{
                  fontFamily: "'Noto Serif JP', serif",
                  fontSize: `${ring.fontSize}px`,
                  letterSpacing: `${RING_TRACKING}em`,
                  fill: '#7A3B3F',
                  opacity: 0.75,
                }}
              >
                {/* 経路は 9 時から時計回り。25% ＝ 12 時に中央を合わせて、止まって見えた
                    瞬間でも問いが円の上を渡っているようにする。 */}
                <textPath
                  href={`#${pathId}-${Math.round(line.radius)}`}
                  startOffset="25%"
                  textAnchor="middle"
                >
                  {line.label}
                </textPath>
              </text>
            </g>
          ))}
        </svg>
      </span>

      {/* 中身の予告。開く前から「この問いに何が入っているか」が見えているようにする。 */}
      <PreviewContents question={question} size={size} />

      {/* 中心の印。手紙が届いているか／読んだかだけを示す（中身は開いてから）。 */}
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
        {question.hasLetter ? (
          <span
            className="flex items-center justify-center rounded-full"
            style={{
              width: `${Math.round(size * 0.28)}px`,
              height: `${Math.round(size * 0.28)}px`,
              background: question.unread
                ? 'linear-gradient(135deg, #FFFFFF, #FBF1EE)'
                : 'rgba(253,251,247,0.5)',
              border: `1.5px solid rgba(122,59,63,${question.unread ? 0.45 : 0.2})`,
            }}
          >
            <svg
              aria-hidden="true"
              width={Math.round(size * 0.13)}
              height={Math.round(size * 0.13)}
              viewBox="0 0 16 16"
              fill="none"
              style={{ color: '#7A3B3F', opacity: question.unread ? 1 : 0.5 }}
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
        ) : (
          <span
            className="rounded-full"
            style={{
              width: `${Math.round(size * 0.1)}px`,
              height: `${Math.round(size * 0.1)}px`,
              background: 'rgba(163,184,168,0.35)',
            }}
          />
        )}
      </span>
    </button>
  );
}

interface PreviewContentsProps {
  question: OrbitQuestion;
  size: number;
}

/**
 * 円の中に浮かぶ言葉と抜粋の印。
 *
 * 開いた画面（SpQuestionZoom）と**同じ輪の並べ方**にしてあるので、タップしたときに
 * 中身が飛ばずにそのまま大きくなる。文字は小さいので読ませることは狙わず、
 * 「この問いには言葉が 3 つ、抜粋が 2 枚ある」と分かればよい。
 */
function PreviewContents({ question, size }: PreviewContentsProps) {
  const keywords = question.keywords.slice(0, PREVIEW_KEYWORDS);
  const snippets = Math.min(question.snippetCount, PREVIEW_SNIPPETS);
  if (keywords.length === 0 && snippets === 0) return null;

  const keywordSlots = ringSlots(keywords.length, PREVIEW_KEYWORD_RADIUS, 0);
  const snippetSlots = ringSlots(snippets, PREVIEW_SNIPPET_RADIUS, Math.PI / 2);
  // 円の大きさに追従させる（奥の小さい円で文字だけが肥大しない）。
  const fontSize = Math.max(8, Math.round(size * 0.062));

  return (
    <span className="pointer-events-none absolute inset-0 block">
      {keywords.map((keyword, i) => {
        const slot = keywordSlots[i];
        if (!slot) return null;
        return (
          <span
            key={keyword}
            className="absolute block max-w-[52%] truncate rounded-full px-1.5 py-0.5"
            style={{
              left: `${slot.xPercent}%`,
              top: `${slot.yPercent}%`,
              transform: 'translate(-50%, -50%)',
              fontSize: `${fontSize}px`,
              lineHeight: 1.3,
              background: 'linear-gradient(135deg, #E8D1B5, #D9B48F)',
              color: 'var(--fg)',
              border: '1px solid rgba(255,255,255,0.5)',
            }}
          >
            {keyword}
          </span>
        );
      })}

      {snippetSlots.map((slot) => (
        <span
          // 抜粋は枚数だけを示す印。中身を持たないので、輪の上の位置がそのまま鍵になる
          // （ringSlots は等間隔なので同じ位置は 2 つ出ない）。
          key={`${slot.xPercent}-${slot.yPercent}`}
          className="absolute block rounded-[3px]"
          style={{
            left: `${slot.xPercent}%`,
            top: `${slot.yPercent}%`,
            transform: 'translate(-50%, -50%)',
            width: `${Math.round(size * 0.1)}px`,
            height: `${Math.round(size * 0.075)}px`,
            background: 'rgba(253,251,247,0.9)',
            border: '1px solid rgba(140,133,126,0.35)',
          }}
        />
      ))}
    </span>
  );
}
