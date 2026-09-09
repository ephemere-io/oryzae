'use client';

import { useCallback, useRef } from 'react';
import {
  type CharPlacement,
  type Destination,
  findJarDestination,
  MAX_TRANSITION_CHARS,
  measureCharPlacements,
} from '@/features/pc/entries/utils/save-transition-geometry';

/**
 * 漬け込みの演出: 紙 → 瓶。
 *
 * 4つの段でできている: 散る → 画面が入れ替わる → 瓶に集まる → 漂って消える。
 *
 * ## 座標は2つとも実測する
 *
 * **どこから飛ぶか** … 紙の上の字が実際にいる場所（Range で1字ずつ測る）。
 * 以前は「1行あたり何字」を幅と font-size から見積もって格子に並べていたが、
 * 紙が中央寄せになり、題の帯が上に載り、行の高さも設定で変わるので、
 * 実際の字の位置とまるで合わなくなっていた。**紙に無い場所から字が飛び立っていた。**
 *
 * **どこへ吸い込まれるか** … 遷移したあとの画面で瓶を探す。演出が始まる時点では
 * 瓶の画面はまだ無いので、始める前には決められない。以前は画面の中央を決め打ちに
 * していたため、左のサイドバーぶんずれ、瓶がどこにあっても同じ場所へ吸い込んでいた。
 * **「変なところにズームアップされて、瓶に入っていくように見えない」**のはこれ。
 *
 * `run(text, editorEl, questionId)` は 1.5 秒で resolve する。呼ぶ側はそこで /jar へ移り、
 * 演出は overlay の上でそのまま続く（合計 ~6.5 秒）。`questionId` を渡すと、
 * **その問いの瓶**を狙って字が飛ぶ（渡さないと、見えている瓶のうち近いものになる）。
 */
export function useSaveTransition() {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const runningRef = useRef(false);

  const run = useCallback(
    (text: string, editorEl: HTMLElement | null, questionId?: string): Promise<void> => {
      if (runningRef.current || !editorEl) return Promise.resolve();
      runningRef.current = true;

      return new Promise<void>((resolve) => {
        // 紙の上の字を、いる場所ごと測る。text は保険（測れない環境では演出を出さない）。
        // **ここで投げさせない。** 投げると走行中の印が立ったままになり、以後この画面では
        // 二度と演出が走らなくなる。書いたものは既に保存されているので、
        // 測れないときは演出だけ静かに諦めるのが正しい。
        let placements: CharPlacement[] = [];
        try {
          placements = text.trim() ? measureCharPlacements(editorEl, MAX_TRANSITION_CHARS) : [];
        } catch {
          placements = [];
        }
        if (placements.length === 0) {
          runningRef.current = false;
          resolve();
          return;
        }

        const overlay = ensureOverlay(overlayRef);
        overlay.innerHTML = '';
        overlay.classList.remove('phase-scatter', 'phase-condense', 'phase-float');
        overlay.classList.add('active');
        ensureStyles();

        const style = getComputedStyle(editorEl);
        const fontSize = Number.parseFloat(style.fontSize);
        const charEls = placements.map((placement) =>
          createCharElement(placement, {
            fontSize,
            fontFamily: style.fontFamily,
            color: style.color,
            overlay,
          }),
        );

        // ── 散る。ここは紙の上での話なので、始める前に決められる ──
        const screenCX = window.innerWidth / 2;
        const screenCY = window.innerHeight / 2;
        for (const [i, el] of charEls.entries()) {
          const placement = placements[i];
          if (!placement) continue;
          const dx = placement.x - screenCX;
          const dy = placement.y - screenCY;
          const dist = Math.hypot(dx, dy) || 1;
          const magnitude = 300 + Math.random() * 500;
          el.style.setProperty(
            '--tx',
            `${(dx / dist) * magnitude + (Math.random() - 0.5) * 200}px`,
          );
          el.style.setProperty(
            '--ty',
            `${(dy / dist) * magnitude + (Math.random() - 0.5) * 200}px`,
          );
          el.style.setProperty('--r', `${(Math.random() - 0.5) * 720}deg`);
        }

        // 70% は最後に消える。残りが瓶の中で漂う。
        const fadeChars = new Set(
          [...charEls].sort(() => Math.random() - 0.5).slice(0, Math.floor(charEls.length * 0.7)),
        );

        // タイマーは**片付けない**。演出は 1.5s で紙の画面が消えたあとも瓶の上で
        // 続くので、アンマウントで止めると途中で終わってしまう。

        // 段1（0s）: 散る
        requestAnimationFrame(() => {
          requestAnimationFrame(() => overlay.classList.add('phase-scatter'));
        });

        // 段2（1.5s）: 呼ぶ側が /jar へ移る
        setTimeout(() => resolve(), 1500);

        // 段3（2s）: 瓶に集まる。**ここで初めて瓶の場所が分かる**（画面が入れ替わったあと）。
        setTimeout(() => {
          const destination = findJarDestination(questionId);
          applyDestination(charEls, placements, destination);
          overlay.classList.remove('phase-scatter');
          overlay.classList.add('phase-condense');
        }, 2000);

        // 段4（3.5s）: 漂って、7割は消える
        setTimeout(() => {
          overlay.classList.remove('phase-condense');
          overlay.classList.add('phase-float');
          for (const el of charEls) {
            if (fadeChars.has(el)) el.classList.add('st-hidden');
          }
          setTimeout(() => {
            for (const el of charEls) {
              if (!fadeChars.has(el)) el.classList.add('st-float-anim');
            }
          }, 1000);
        }, 3500);

        // 段5（6.5s）: 片付け
        setTimeout(() => {
          overlay.style.transition = 'opacity 1.5s ease';
          overlay.style.opacity = '0';
          setTimeout(() => {
            // 面ごと片付ける。中身を空にするだけだと、演出のたびに使い捨ての div が
            // body に積み上がっていく（紙の画面は演出の途中で消えるので、
            // この時点でこの hook はもう居ない）。
            overlay.remove();
            overlayRef.current = null;
            runningRef.current = false;
          }, 1500);
        }, 6500);
      });
    },
    [],
  );

  return run;
}

function ensureOverlay(ref: React.RefObject<HTMLDivElement | null>): HTMLDivElement {
  const existing = ref.current;
  if (existing) return existing;
  const overlay = document.createElement('div');
  overlay.id = 'save-transition-overlay';
  document.body.appendChild(overlay);
  ref.current = overlay;
  return overlay;
}

function ensureStyles(): void {
  if (document.getElementById('save-transition-styles')) return;
  const style = document.createElement('style');
  style.id = 'save-transition-styles';
  style.textContent = TRANSITION_CSS;
  document.head.appendChild(style);
}

interface CharStyle {
  fontSize: number;
  fontFamily: string;
  color: string;
  overlay: HTMLElement;
}

/**
 * 1字ぶんの要素を、**測った場所そのもの**に置く。
 *
 * 中心の座標で測っているので、半分ずらして左上に合わせる。ここを合わせないと
 * 字が半文字ぶん浮いた状態から飛び立つ。
 */
function createCharElement(placement: CharPlacement, style: CharStyle): HTMLSpanElement {
  const el = document.createElement('span');
  el.className = 'st-char';
  el.style.fontSize = `${style.fontSize}px`;
  el.style.fontFamily = style.fontFamily;
  el.style.color = style.color;
  el.style.left = `${placement.x - style.fontSize / 2}px`;
  el.style.top = `${placement.y - style.fontSize / 2}px`;

  const inner = document.createElement('span');
  inner.className = 'st-char-inner';
  inner.textContent = placement.char;
  el.appendChild(inner);

  style.overlay.appendChild(el);
  return el;
}

/** 瓶の場所が決まってから、集まる先と漂う先を配る。 */
function applyDestination(
  charEls: HTMLSpanElement[],
  placements: CharPlacement[],
  destination: Destination,
): void {
  const total = charEls.length;
  for (const [i, el] of charEls.entries()) {
    const placement = placements[i];
    if (!placement) continue;

    // 瓶の中で輪になるように散らす（1点に重ねると1文字の塊にしか見えない）。
    const angle = (i / total) * Math.PI * 2;
    const radius = destination.radius + (Math.random() - 0.5) * (destination.radius * 0.6);
    const circleX = Math.cos(angle) * radius;
    const circleY = Math.sin(angle) * radius;

    const cx = destination.x - placement.x + circleX;
    const cy = destination.y - placement.y + circleY;

    el.style.setProperty('--cx', `${cx}px`);
    el.style.setProperty('--cy', `${cy}px`);
    el.style.setProperty('--cr', `${(angle * 180) / Math.PI + (Math.random() - 0.5) * 30}deg`);
    el.style.setProperty('--fx', `${cx + (Math.random() - 0.5) * 20}px`);
    el.style.setProperty('--fy', `${cy + (Math.random() - 0.5) * 20}px`);
    el.style.setProperty('--fr', `${(Math.random() - 0.5) * 30}deg`);

    const inner = el.querySelector('.st-char-inner');
    if (inner instanceof HTMLElement) {
      inner.style.setProperty('--fdur', `${3 + Math.random() * 4}s`);
      inner.style.setProperty('--fdel', `-${Math.random() * 2}s`);
    }
  }
}

/** CSS injected once into <head> */
const TRANSITION_CSS = `
#save-transition-overlay {
  position: fixed; inset: 0; z-index: 9999;
  pointer-events: none; overflow: hidden;
  display: none;
}
#save-transition-overlay.active { display: block; }

.st-char {
  position: fixed;
  display: inline-block;
  /* 箱を字そのものの大きさにする。行送りが乗ると箱が字より高くなり、
     中心で置いたつもりが数 px 下にずれる（実測 8px）。 */
  line-height: 1;
  will-change: transform, opacity;
  transition: transform 1.5s cubic-bezier(0.4, 0, 0.2, 1), opacity 1s, color 1.5s;
  pointer-events: none;
  z-index: 10000;
}

#save-transition-overlay.phase-scatter .st-char {
  transform: translate(var(--tx), var(--ty)) rotate(var(--r));
  opacity: 0.4;
  color: #b45309;
}

#save-transition-overlay.phase-condense .st-char {
  transform: translate(var(--cx), var(--cy)) scale(0.25) rotate(var(--cr));
  opacity: 0.95;
  color: #5d2e0f;
  transition-duration: 1.5s;
  transition-timing-function: cubic-bezier(0.6, 0, 0.4, 1);
  filter: blur(0.3px);
}

#save-transition-overlay.phase-float .st-char {
  transform: translate(var(--fx), var(--fy)) rotate(var(--fr)) scale(0.25);
  opacity: 0.6;
  transition-duration: 2s;
  transition-timing-function: ease-out;
}

.st-char.st-hidden {
  opacity: 0 !important;
  transform: scale(0) !important;
  transition: opacity 0.8s ease, transform 0.8s ease !important;
}

@keyframes st-gentle-float {
  0%   { transform: translate(0, 0) rotate(0deg); }
  33%  { transform: translate(8px, -12px) rotate(5deg); }
  66%  { transform: translate(-5px, -18px) rotate(-3deg); }
  100% { transform: translate(0, 0) rotate(0deg); }
}
.st-char-inner {
  display: inline-block;
  will-change: transform;
}
.st-float-anim .st-char-inner {
  animation: st-gentle-float var(--fdur) infinite alternate ease-in-out;
  animation-delay: var(--fdel);
}
`;
