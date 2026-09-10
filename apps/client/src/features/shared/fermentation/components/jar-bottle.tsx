'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { JAR_PATH, JAR_VIEWBOX, toUnitPath } from '@/features/shared/fermentation/jar-path';

/**
 * 中央に置く「壜」の絵（端末非依存）。
 *
 * PC の JarView から切り出した。SP の瓶も **同じ壜を中央に置く**（見た目が違うと
 * 「同じ場所」に見えない）ため、どちらか一方に置くとコピーが生まれる。ここは
 * ドメインの見た目であって端末の判断を含まないので shared に置ける。
 *
 * 親の大きさいっぱいに描く。位置と寸法は呼び出し側が決める
 * （PC は world の中央に 500x620、SP は画面中央に画面幅なり）。
 */

/* 壜の中に漂う言葉。意味を読ませるものではなく、発酵の気配を出すための粒。 */
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
const BLUR_LEVELS = [0.6, 0.8, 1.2, 1.8, 2.2, 2.5, 3.5, 4];
const FONT_SIZES = [11, 12, 14, 16, 18, 22, 26];

/* Microbe positions inside the jar */
const JAR_MICROBES: Array<{
  type: 'koji' | 'yeast' | 'lab';
  top: string;
  left: string;
  size: number;
  anim: string;
  opacity: number;
}> = [
  { type: 'koji', top: '32%', left: '55%', size: 32, anim: 'j2-float-2', opacity: 0.5 },
  { type: 'yeast', top: '52%', left: '22%', size: 24, anim: 'j2-float-3', opacity: 0.45 },
  { type: 'lab', top: '75%', left: '60%', size: 36, anim: 'j2-float-1', opacity: 0.4 },
  { type: 'koji', top: '15%', left: '68%', size: 28, anim: 'j2-float-2', opacity: 0.5 },
  { type: 'yeast', top: '45%', left: '78%', size: 24, anim: 'j2-float-1', opacity: 0.55 },
  { type: 'lab', top: '65%', left: '35%', size: 32, anim: 'j2-float-3', opacity: 0.4 },
];

/* Microbe SVG templates matching the reference design */
const MICROBE_SVGS = {
  koji: '<svg viewBox="0 0 28 28"><g fill="none"><path d="M14,24 C10,20 8,14 12,8 C14,6 16,6 18,8 C22,12 22,18 18,22" stroke="#A3B8A8" stroke-width="2" stroke-linecap="round" opacity="0.65"/><ellipse cx="14" cy="6" rx="3.5" ry="5" fill="#A3B8A8" opacity="0.35"/><ellipse cx="9" cy="10" rx="2" ry="3" fill="#8EA89C" opacity="0.45"/><ellipse cx="19" cy="14" rx="1.5" ry="2.5" fill="#8EA89C" opacity="0.3"/></g></svg>',
  yeast:
    '<svg viewBox="0 0 24 36"><g fill="#D9B48F" opacity="0.55"><rect x="8" y="4" width="8" height="20" rx="4" fill="#D9B48F" opacity="0.6"/><rect x="6" y="2" width="5" height="14" rx="2.5" fill="#E2C28E" opacity="0.7"/><rect x="14" y="8" width="4" height="12" rx="2" fill="#D9B48F" opacity="0.45"/><rect x="10" y="20" width="4" height="10" rx="2" fill="#E2C28E" opacity="0.5"/></g></svg>',
  lab: '<svg viewBox="0 0 32 20"><g fill="none"><path d="M6,14 Q12,6 18,12 Q26,18 30,10" stroke="#A3B8A8" stroke-width="2.5" stroke-linecap="round" opacity="0.6"/><circle cx="6" cy="14" r="3" fill="#A3B8A8" opacity="0.4"/><circle cx="18" cy="12" r="2.5" fill="#8EA89C" opacity="0.35"/><circle cx="30" cy="10" r="2" fill="#A3B8A8" opacity="0.3"/></g></svg>',
};

/**
 * 切り抜きの id。中の言葉を壜の内側に閉じ込めるのに使う。
 *
 * 同じ頁に壜が2つあっても中身は同じなので、id が重なっても見た目は変わらない。
 */
const CLIP_ID = 'jar-bottle-clip';

/** 器の大きさに依らない切り抜き（0..1 の比率）。 */
const JAR_UNIT_PATH = toUnitPath(JAR_PATH, JAR_VIEWBOX.width, JAR_VIEWBOX.height);

/**
 * viewBox 基準の px を、器の幅に対する比（cqw）へ直す。
 *
 * 中の言葉・微生物は SVG の外（HTML）に居るので viewBox の伸縮に乗らない。
 * 器の幅 480 のときに元の px と一致し、器が小さくなれば一緒に縮む。
 */
function scaled(px: number): string {
  return `${Math.round((px / JAR_VIEWBOX.width) * 1e5) / 1e3}cqw`;
}

export function JarBottle() {
  const t = useTranslations('fermentation');
  const words = useMemo(() => ALL_WORD_KEYS.map((key) => t(key)), [t]);

  return (
    // 壜は viewBox の比（480:600）を保った箱の中に描く。器の比がこれと違うと、
    // SVG は余白を作って中央に寄る（preserveAspectRatio）ため、絵と切り抜きがずれる。
    <div
      className="flex h-full w-full items-center justify-center"
      {...verifyAttrs({ unit: 'JarBottle', wordCount: words.length })}
    >
      <div
        className="relative"
        style={{
          width: '100%',
          maxHeight: '100%',
          aspectRatio: `${JAR_VIEWBOX.width} / ${JAR_VIEWBOX.height}`,
          // 中に漂わせる言葉と微生物の寸法を、器の幅に対する比で書けるようにする
          // （cqw）。絶対 px のままだと、小さい SP の壜の中で文字だけが肥大した。
          containerType: 'inline-size',
        }}
      >
        {/* Jar glow */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(226,194,142,0.1)',
            borderRadius: '200px',
            filter: 'blur(80px)',
            animation: 'j2-pulse 4s cubic-bezier(0.4,0,0.6,1) infinite',
          }}
        />

        {/* Jar SVG */}
        <svg
          aria-hidden="true"
          className="h-full w-full"
          viewBox={`0 0 ${JAR_VIEWBOX.width} ${JAR_VIEWBOX.height}`}
          fill="none"
          style={{ filter: 'drop-shadow(0 20px 40px rgba(140,133,126,0.15))' }}
        >
          {/* Glass body */}
          <path
            d={JAR_PATH}
            fill="rgba(253,251,247,0.2)"
            stroke="rgba(255,255,255,0.8)"
            strokeWidth="1.5"
          />
          {/* Fermentation liquid */}
          <path
            d="M78,450 C78,350 180,310 200,240 C220,240 270,310 402,450 C410,580 70,580 78,450 Z"
            fill="url(#j2-fermentGradient)"
            opacity="0.6"
            filter="url(#blurLiquid)"
          />
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
            <path d="M240,280 Q 280,350 250,420 T 320,520" className="j2-float-1" />
            <path d="M320,320 Q 290,380 340,440 T 260,540" className="j2-float-2" />
            <path d="M200,220 Q 240,290 180,350 T 210,480" className="j2-float-3" />
            <path d="M160,360 Q 140,420 200,460 T 140,530" className="j2-float-1" />
            <path d="M260,200 Q 270,250 240,290" />
          </g>
          <defs>
            {/* 中の言葉を壜の内側に閉じ込める切り抜き。比率指定なので器の大きさに依らない。 */}
            <clipPath id={CLIP_ID} clipPathUnits="objectBoundingBox">
              <path d={JAR_UNIT_PATH} />
            </clipPath>
            <linearGradient id="j2-fermentGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(226,194,142,0.1)" />
              <stop offset="50%" stopColor="rgba(142,168,156,0.2)" />
              <stop offset="100%" stopColor="rgba(226,194,142,0.4)" />
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

        {/* Text particles + microbes clipped inside jar */}
        <div
          className="pointer-events-auto absolute inset-0 overflow-hidden"
          style={{
            // path() は絶対 px なので器の大きさに追従しない（SP で壜の外へこぼれた）。
            // 比率で切り抜く SVG の clipPath を参照する。
            clipPath: `url(#${CLIP_ID})`,
          }}
        >
          {words.map((word, i) => {
            const top = 18 + ((i * 37) % 65);
            const left = 22 + ((i * 53) % 60);
            const blur = BLUR_LEVELS[i % BLUR_LEVELS.length];
            const fontSize = FONT_SIZES[i % FONT_SIZES.length];
            const opacity = 0.3 + (i % 5) * 0.12;
            return (
              <span
                key={ALL_WORD_KEYS[i]}
                className={`${FLOAT_CLASSES[i % 3]} pointer-events-none select-none`}
                style={{
                  position: 'absolute',
                  top: `${top}%`,
                  left: `${left}%`,
                  filter: `blur(${scaled(blur)})`,
                  fontSize: scaled(fontSize),
                  opacity,
                  letterSpacing: '0.15em',
                  fontFamily: "'Noto Serif JP', serif",
                  color: 'var(--date-color)',
                }}
              >
                {word}
              </span>
            );
          })}
          {JAR_MICROBES.map((m) => (
            <div
              key={`microbe-${m.type}-${m.top}-${m.left}`}
              className={m.anim}
              style={{
                position: 'absolute',
                top: m.top,
                left: m.left,
                width: scaled(m.size),
                height: scaled(m.size),
                opacity: m.opacity,
                pointerEvents: 'none',
              }}
              // biome-ignore lint/security/noDangerouslySetInnerHtml: static constant SVG
              dangerouslySetInnerHTML={{ __html: MICROBE_SVGS[m.type] }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
