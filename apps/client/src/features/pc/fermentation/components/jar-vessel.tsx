'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import {
  BUBBLE_START_RATIO,
  bubbleRisePx,
  JAR_BUBBLE_SLOTS,
  JAR_MICROBE_SLOTS,
  jarParticleCount,
  jarVisuals,
} from '@/features/pc/fermentation/utils/jar-visuals';

/**
 * 瓶そのもの（ガラス・発酵液・浮遊する文字・微生物・泡）。
 *
 * issue #278: 見た目は readiness（＝持っている問いの readiness の総和, 0〜3）に追従する。
 * 0→1 で液が満ち、1→2 で微生物が増えて動きが速くなり、2→3 で泡立つ。マッピングの正は
 * `utils/jar-visuals.ts`。**数値は一切表示しない**（進捗バーも "あと N%" も出さない）。
 *
 * JarView から切り出したのは、瓶の見た目だけを readiness の各段階で孤立検証したいから。
 * JarView 側は問いサークル・モーダル・ドラッグの合成に専念する。
 */

/** 瓶の輪郭（参考デザイン）。ガラス本体・液体のクリップ・中身のクリップで使い回す。 */
const JAR_PATH =
  'M190,100 C190,60 290,60 290,100 C290,130 270,140 270,170 C270,270 410,330 410,480 C410,580 70,580 70,480 C70,330 210,270 210,170 C210,140 190,130 190,100 Z';

/* 瓶の中を漂う文字。並び順が意味を持つ（top/left/blur などの決定的なシードに使う）。
 * 先頭ほど readiness が低いうちから見えるので、発酵そのものを指す語を前に置く。 */
const PARTICLE_WORD_KEYS = [
  'jar.particle_fermentation',
  'jar.particle_memory',
  'jar.particle_silence',
  'jar.particle_light',
  'jar.particle_dark',
  'jar.particle_morning',
  'jar.particle_koji',
  'jar.particle_breath',
] as const;
const FILLER_WORD_KEYS = [
  'jar.filler_rice',
  'jar.filler_water',
  'jar.filler_soil',
  'jar.filler_brew',
  'jar.filler_question',
  'jar.filler_time',
  'jar.filler_sediment',
  'jar.filler_wind',
  'jar.filler_season',
  'jar.filler_microbe',
  'jar.filler_heat',
  'jar.filler_propagate',
  'jar.filler_heart',
  'jar.filler_autumn',
  'jar.filler_shallows',
] as const;
const ALL_WORD_KEYS = [...PARTICLE_WORD_KEYS, ...FILLER_WORD_KEYS];
const FLOAT_CLASSES = ['j2-float-1', 'j2-float-2', 'j2-float-3'];
const FLOAT_BASE_SECONDS = [8, 12, 10];
const BLUR_LEVELS = [0.6, 0.8, 1.2, 1.8, 2.2, 2.5, 3.5, 4];
const FONT_SIZES = [11, 12, 14, 16, 18, 22, 26];

/* 瓶の中の微生物の定位置。readiness に応じて先頭から microbeCount 個だけ描く。 */
const JAR_MICROBES: Array<{
  type: 'koji' | 'yeast' | 'lab';
  top: string;
  left: string;
  size: number;
  anim: string;
  animSeconds: number;
  opacity: number;
}> = [
  {
    type: 'koji',
    top: '32%',
    left: '55%',
    size: 32,
    anim: 'j2-float-2',
    animSeconds: 12,
    opacity: 0.5,
  },
  {
    type: 'yeast',
    top: '52%',
    left: '22%',
    size: 24,
    anim: 'j2-float-3',
    animSeconds: 10,
    opacity: 0.45,
  },
  {
    type: 'lab',
    top: '75%',
    left: '60%',
    size: 36,
    anim: 'j2-float-1',
    animSeconds: 8,
    opacity: 0.4,
  },
  {
    type: 'koji',
    top: '15%',
    left: '68%',
    size: 28,
    anim: 'j2-float-2',
    animSeconds: 12,
    opacity: 0.5,
  },
  {
    type: 'yeast',
    top: '45%',
    left: '78%',
    size: 24,
    anim: 'j2-float-1',
    animSeconds: 8,
    opacity: 0.55,
  },
  {
    type: 'lab',
    top: '65%',
    left: '35%',
    size: 32,
    anim: 'j2-float-3',
    animSeconds: 10,
    opacity: 0.4,
  },
];

/* 泡の定位置。2.0→3.0 の区間で先頭から bubbleCount 個ずつ増える。 */
const JAR_BUBBLES: Array<{ left: string; size: number; delay: number; duration: number }> = [
  { left: '46%', size: 7, delay: 0, duration: 4.2 },
  { left: '58%', size: 5, delay: 0.7, duration: 3.6 },
  { left: '38%', size: 6, delay: 1.4, duration: 4.8 },
  { left: '64%', size: 4, delay: 0.3, duration: 3.2 },
  { left: '50%', size: 9, delay: 2.1, duration: 5.4 },
  { left: '32%', size: 5, delay: 1.1, duration: 4.0 },
  { left: '70%', size: 6, delay: 2.6, duration: 4.6 },
  { left: '43%', size: 4, delay: 0.9, duration: 3.4 },
  { left: '55%', size: 8, delay: 1.8, duration: 5.0 },
  { left: '27%', size: 5, delay: 2.4, duration: 4.4 },
  { left: '61%', size: 7, delay: 0.5, duration: 3.8 },
  { left: '48%', size: 4, delay: 3.0, duration: 5.6 },
  { left: '36%', size: 6, delay: 1.6, duration: 4.1 },
  { left: '67%', size: 5, delay: 2.8, duration: 4.9 },
];

/* Microbe SVG templates matching the reference design */
const MICROBE_SVGS = {
  koji: '<svg viewBox="0 0 28 28"><g fill="none"><path d="M14,24 C10,20 8,14 12,8 C14,6 16,6 18,8 C22,12 22,18 18,22" stroke="#A3B8A8" stroke-width="2" stroke-linecap="round" opacity="0.65"/><ellipse cx="14" cy="6" rx="3.5" ry="5" fill="#A3B8A8" opacity="0.35"/><ellipse cx="9" cy="10" rx="2" ry="3" fill="#8EA89C" opacity="0.45"/><ellipse cx="19" cy="14" rx="1.5" ry="2.5" fill="#8EA89C" opacity="0.3"/></g></svg>',
  yeast:
    '<svg viewBox="0 0 24 36"><g fill="#D9B48F" opacity="0.55"><rect x="8" y="4" width="8" height="20" rx="4" fill="#D9B48F" opacity="0.6"/><rect x="6" y="2" width="5" height="14" rx="2.5" fill="#E2C28E" opacity="0.7"/><rect x="14" y="8" width="4" height="12" rx="2" fill="#D9B48F" opacity="0.45"/><rect x="10" y="20" width="4" height="10" rx="2" fill="#E2C28E" opacity="0.5"/></g></svg>',
  lab: '<svg viewBox="0 0 32 20"><g fill="none"><path d="M6,14 Q12,6 18,12 Q26,18 30,10" stroke="#A3B8A8" stroke-width="2.5" stroke-linecap="round" opacity="0.6"/><circle cx="6" cy="14" r="3" fill="#A3B8A8" opacity="0.4"/><circle cx="18" cy="12" r="2.5" fill="#8EA89C" opacity="0.35"/><circle cx="30" cy="10" r="2" fill="#A3B8A8" opacity="0.3"/></g></svg>',
};

/**
 * 発酵液を空にするときの下げ幅（viewBox 単位）。液面 y≈240 が瓶底 y≈580 を下回るまで
 * 下げると、瓶の輪郭でクリップされて「空っぽ」に見える。
 */
const LIQUID_DROP = 340;

/**
 * 泡の上昇距離を CSS 変数として渡す。keyframe 側は
 * `translateY(calc(var(--jar-bubble-rise) * -1))` で読む。
 *
 * React.CSSProperties はカスタムプロパティを型に持たないので、`as` を避けて
 * Record として組み立て、style へ spread する。
 */
function bubbleRiseVar(height: number): Record<string, string> {
  return { '--jar-bubble-rise': `${bubbleRisePx(height)}px` };
}

/** 液体グラデーションの色を warmth で補間する。0 は澄んだ緑寄り、1 は温かい琥珀。 */
function liquidStops(warmth: number) {
  const mix = (cold: number, warm: number) => Math.round(cold + (warm - cold) * warmth);
  return {
    top: `rgba(226,194,142,${(0.06 + 0.1 * warmth).toFixed(3)})`,
    middle: `rgba(${mix(142, 205)},${mix(168, 170)},${mix(156, 120)},${(0.16 + 0.14 * warmth).toFixed(3)})`,
    bottom: `rgba(226,194,142,${(0.28 + 0.26 * warmth).toFixed(3)})`,
  };
}

interface JarVesselProps {
  /**
   * いちばん進んだ問いの readiness（0〜1）。**演出の段階**を決める。
   * 問いを1つしか持たない人でも、これが 1.0 まで行けば泡立つ。
   */
  top?: number;
  /**
   * 全問いの readiness の総和（0〜3）。**密度**（微生物と泡の数・動きの速さ）を決める。
   * 同時に多く発酵させている人ほど瓶が賑やかになる。
   */
  total?: number;
  /** 瓶の描画サイズ（px）。JarView のレイアウトに合わせて渡す。 */
  width?: number;
  height?: number;
  /**
   * 瓶の中を漂う言葉。**その人の発酵が生んだキーワード**を渡すために開けてある。
   * 空なら既定の語（発酵 / 記憶 / …）を使う ── 1 件も発酵していない人の瓶を空にしない。
   * 並び順が top/left/blur の決定的なシードになるので、渡す側で順番を安定させること。
   */
  words?: readonly string[];
}

/** 既定値をリテラルで書くと毎レンダーで別物になり、useMemo が効かなくなる。 */
const NO_WORDS: readonly string[] = [];

export function JarVessel({
  top = 0,
  total = 0,
  width = 420,
  height = 520,
  words = NO_WORDS,
}: JarVesselProps) {
  const t = useTranslations('fermentation');
  const visuals = jarVisuals(top, total);
  // key に語そのものを使うので、ここで重複を落としておく（渡された語は同じとは限らない）。
  const allWords = useMemo(
    () => [...new Set(words.length > 0 ? words : ALL_WORD_KEYS.map((key) => t(key)))],
    [words, t],
  );
  const wordCount = jarParticleCount(top, allWords.length);
  const stops = liquidStops(visuals.warmth);
  // 動きが活発になるほどアニメーションを短く。glow の脈も一緒に速くする。
  const speedUp = (seconds: number) => `${(seconds / visuals.agitation).toFixed(2)}s`;

  return (
    <div
      {...verifyAttrs({
        unit: 'JarVessel',
        // 契約として出すのは「見た目のどこが動いたか」だけ。readiness の数値は出さない
        // （DOM に出ると devtools から逆算できてしまい、issue #278 の狙いが崩れる）。
        fillPct: Math.round(visuals.fillRatio * 100),
        microbes: visuals.microbeCount,
        bubbles: visuals.bubbleCount,
        words: wordCount,
      })}
      className="pointer-events-none absolute z-[2]"
      style={{
        left: '50%',
        top: '45%',
        transform: 'translate(-50%, -55%)',
        width: `${width}px`,
        height: `${height}px`,
        animation: 'fadeIn 0.5s ease-out forwards',
        // 泡の上昇距離。keyframe から calc() で読むので、瓶の高さが変わっても追従する。
        ...bubbleRiseVar(height),
      }}
    >
      {/* 瓶が使うキーフレーム。JarView にも同名の定義があるが（QuestionCircle が親の定義に
          依存している）、孤立検証で瓶単体を描いたときも動くようここでも宣言する。
          同名・同内容なので重複しても描画は変わらない。 */}
      <style>{`
        @keyframes j2-float-1 {
          0%, 100% { transform: translateY(0) translateX(0); }
          33% { transform: translateY(-10px) translateX(5px); }
          66% { transform: translateY(5px) translateX(-5px); }
        }
        @keyframes j2-float-2 {
          0%, 100% { transform: translateY(0) translateX(0); }
          33% { transform: translateY(5px) translateX(-8px); }
          66% { transform: translateY(-8px) translateX(3px); }
        }
        @keyframes j2-float-3 {
          0%, 100% { transform: translateY(0) translateX(0); }
          33% { transform: translateY(-6px) translateX(-4px); }
          66% { transform: translateY(8px) translateX(6px); }
        }
        .j2-float-1 { animation: j2-float-1 8s ease-in-out infinite; }
        .j2-float-2 { animation: j2-float-2 12s ease-in-out infinite; }
        .j2-float-3 { animation: j2-float-3 10s ease-in-out infinite 2s; }

        @keyframes j2-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        /* 泡: 液の底から浮かび上がって水面で消える。readiness 2.0 以降だけ描画される。 */
        @keyframes j2-bubble {
          0%   { transform: translateY(0) scale(0.7); opacity: 0; }
          15%  { opacity: 0.9; }
          80%  { opacity: 0.5; }
          100% { transform: translateY(calc(var(--jar-bubble-rise) * -1)) scale(1.15); opacity: 0; }
        }
        .j2-bubble { animation-name: j2-bubble; animation-timing-function: ease-in; animation-iteration-count: infinite; }
      `}</style>

      {/* Jar glow */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(226,194,142,0.1)',
          borderRadius: '200px',
          filter: 'blur(80px)',
          animation: `j2-pulse ${speedUp(4)} cubic-bezier(0.4,0,0.6,1) infinite`,
        }}
      />

      {/* Jar SVG */}
      <svg
        aria-hidden="true"
        className="h-full w-full"
        viewBox="0 0 480 600"
        fill="none"
        style={{ filter: 'drop-shadow(0 20px 40px rgba(140,133,126,0.15))' }}
      >
        {/* Glass body.
          縁は元々 白 0.8 だったが、紙色（--bg #f9f8f4）の地の上ではほぼ消えて
          瓶の形が読めなかった。輪郭を落として形が立つようにする。濃くしすぎると
          絵が硬くなるので、0.3 / 1.2px に留める。 */}
        <path
          d={JAR_PATH}
          fill="rgba(226,194,142,0.05)"
          stroke="rgba(122,116,64,0.3)"
          strokeWidth="1.2"
        />
        {/* Fermentation liquid — readiness が低いほど下へ沈み、瓶の輪郭で切り取られて消える */}
        <g clipPath="url(#j2-jarClip)">
          <path
            d="M78,450 C78,350 180,310 200,240 C220,240 270,310 402,450 C410,580 70,580 78,450 Z"
            fill="url(#j2-fermentGradient)"
            opacity="0.6"
            filter="url(#blurLiquid)"
            style={{
              transform: `translateY(${((1 - visuals.fillRatio) * LIQUID_DROP).toFixed(1)}px)`,
              transition: 'transform 1.2s ease-out',
            }}
          />
        </g>
        {/* Highlight stroke (left) */}
        <path
          d="M100,460 C100,340 220,270 220,180"
          stroke="url(#j2-highlightGradient)"
          strokeWidth="4"
          strokeLinecap="round"
          filter="url(#blurHighlight)"
          opacity="0.7"
        />
        {/* Glass reflection (right) */}
        <path
          d="M380,480 C380,380 260,280 260,190"
          stroke="rgba(255,255,255,0.4)"
          strokeWidth="2"
          strokeLinecap="round"
          filter="url(#blurReflection)"
        />
        {/* Rim highlight */}
        <path
          d="M210,100 Q 240,110 270,100"
          stroke="rgba(255,255,255,0.9)"
          strokeWidth="3"
          strokeLinecap="round"
          filter="url(#blurReflection)"
        />
        {/* Interior flowing curves */}
        <g stroke="rgba(226,194,142,0.4)" strokeWidth="0.75" fill="none" opacity="0.8">
          <path
            d="M240,280 Q 280,350 250,420 T 320,520"
            className="j2-float-1"
            style={{ animationDuration: speedUp(8) }}
          />
          <path
            d="M320,320 Q 290,380 340,440 T 260,540"
            className="j2-float-2"
            style={{ animationDuration: speedUp(12) }}
          />
          <path
            d="M200,220 Q 240,290 180,350 T 210,480"
            className="j2-float-3"
            style={{ animationDuration: speedUp(10) }}
          />
          <path
            d="M160,360 Q 140,420 200,460 T 140,530"
            className="j2-float-1"
            style={{ animationDuration: speedUp(8) }}
          />
          <path d="M260,200 Q 270,250 240,290" />
        </g>
        <defs>
          <clipPath id="j2-jarClip">
            <path d={JAR_PATH} />
          </clipPath>
          <linearGradient id="j2-fermentGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={stops.top} />
            <stop offset="50%" stopColor={stops.middle} />
            <stop offset="100%" stopColor={stops.bottom} />
          </linearGradient>
          <linearGradient id="j2-highlightGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.8)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          <filter id="blurLiquid">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" />
          </filter>
          <filter id="blurHighlight">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1" />
          </filter>
          <filter id="blurReflection">
            <feGaussianBlur in="SourceGraphic" stdDeviation="0.5" />
          </filter>
        </defs>
      </svg>

      {/* Text particles + microbes + bubbles clipped inside jar */}
      <div
        className="pointer-events-auto absolute inset-0 overflow-hidden"
        style={{ clipPath: `path('${JAR_PATH}')` }}
      >
        {allWords.slice(0, wordCount).map((word, i) => {
          const top = 18 + ((i * 37) % 65);
          const left = 22 + ((i * 53) % 60);
          const blur = BLUR_LEVELS[i % BLUR_LEVELS.length];
          const fontSize = FONT_SIZES[i % FONT_SIZES.length];
          const opacity = 0.3 + (i % 5) * 0.12;
          return (
            <span
              key={word}
              className={`${FLOAT_CLASSES[i % 3]} pointer-events-none select-none`}
              style={{
                position: 'absolute',
                top: `${top}%`,
                left: `${left}%`,
                filter: `blur(${blur}px)`,
                fontSize: `${fontSize}px`,
                opacity,
                letterSpacing: '0.15em',
                fontFamily: "'Noto Serif JP', serif",
                color: 'var(--date-color)',
                animationDuration: speedUp(FLOAT_BASE_SECONDS[i % 3]),
              }}
            >
              {word}
            </span>
          );
        })}
        {JAR_MICROBES.slice(0, visuals.microbeCount).map((m) => (
          <div
            key={`microbe-${m.type}-${m.top}-${m.left}`}
            data-jar-microbe=""
            className={m.anim}
            style={{
              position: 'absolute',
              top: m.top,
              left: m.left,
              width: `${m.size}px`,
              height: `${m.size}px`,
              opacity: m.opacity,
              animationDuration: speedUp(m.animSeconds),
              pointerEvents: 'none',
            }}
            // biome-ignore lint/security/noDangerouslySetInnerHtml: static constant SVG
            dangerouslySetInnerHTML={{ __html: MICROBE_SVGS[m.type] }}
          />
        ))}
        {JAR_BUBBLES.slice(0, visuals.bubbleCount).map((b) => (
          <span
            key={`bubble-${b.left}-${b.delay}`}
            data-jar-bubble=""
            className="j2-bubble pointer-events-none"
            style={{
              position: 'absolute',
              bottom: `${BUBBLE_START_RATIO * 100}%`,
              left: b.left,
              width: `${b.size}px`,
              height: `${b.size}px`,
              borderRadius: '9999px',
              background: 'rgba(255,255,255,0.55)',
              border: '1px solid rgba(255,255,255,0.75)',
              animationDelay: `${b.delay}s`,
              animationDuration: `${b.duration}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

/** 検証スペックが「上限まで描けるか」を確かめるために参照する。 */
export const JAR_VESSEL_SLOTS = {
  microbes: JAR_MICROBE_SLOTS,
  bubbles: JAR_BUBBLE_SLOTS,
  words: ALL_WORD_KEYS.length,
};
