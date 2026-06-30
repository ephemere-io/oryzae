'use client';

import { useCallback, useRef } from 'react';

/**
 * Save transition hook: editor → jar view.
 *
 * Reproduces the reference design's 4-phase character animation:
 *   Scatter → Background swap → Condense into jar → Float & fade
 *
 * Returns a `run(text, editorEl)` callback that creates a fixed overlay
 * of individual character elements, then drives them through CSS
 * transition phases. The caller is responsible for routing to /jar
 * after the transition completes (~6.5 s) via the returned Promise.
 */
export function useSaveTransition() {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const runningRef = useRef(false);

  const run = useCallback((text: string, editorEl: HTMLElement | null): Promise<void> => {
    if (runningRef.current || !editorEl) return Promise.resolve();
    runningRef.current = true;

    return new Promise<void>((resolve) => {
      // ── Prepare characters (max ~200 for performance) ──
      const rawChars = Array.from(text.replace(/[\n\r\t]/g, '').replace(/\s+/g, ' '));
      const chars =
        rawChars.length > 200
          ? rawChars.filter((_, i) => i % Math.ceil(rawChars.length / 200) === 0)
          : rawChars;

      if (chars.length === 0) {
        runningRef.current = false;
        resolve();
        return;
      }

      // ── Create overlay ──
      let overlay = overlayRef.current;
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'save-transition-overlay';
        document.body.appendChild(overlay);
        overlayRef.current = overlay;
      }
      overlay.innerHTML = '';
      overlay.classList.remove('phase-scatter', 'phase-condense', 'phase-float');
      overlay.classList.add('active');

      // ── Inject CSS (once) ──
      if (!document.getElementById('save-transition-styles')) {
        const style = document.createElement('style');
        style.id = 'save-transition-styles';
        style.textContent = TRANSITION_CSS;
        document.head.appendChild(style);
      }

      // ── Build character DOM ──
      const editorRect = editorEl.getBoundingClientRect();
      const fontSize = Number.parseFloat(getComputedStyle(editorEl).fontSize);
      const isVertical = getComputedStyle(editorEl).writingMode.includes('vertical');
      const fontFamily = getComputedStyle(editorEl).fontFamily;
      const color = getComputedStyle(editorEl).color;

      const charEls: HTMLSpanElement[] = [];
      for (const [i, char] of chars.entries()) {
        if (char === ' ' || char === '\u3000') continue;

        const el = document.createElement('span');
        el.className = 'st-char';
        el.style.fontSize = `${fontSize}px`;
        el.style.fontFamily = fontFamily;
        el.style.color = color;

        const inner = document.createElement('span');
        inner.className = 'st-char-inner';
        inner.textContent = char;
        el.appendChild(inner);

        // Approximate position in editor
        const lineHeight = fontSize * 1.85;
        let x: number;
        let y: number;
        if (isVertical) {
          const col = Math.floor(i / Math.floor(editorRect.height / lineHeight));
          const row = i % Math.floor(editorRect.height / lineHeight);
          x = editorRect.right - (col + 1) * lineHeight;
          y = editorRect.top + row * fontSize;
        } else {
          const row = Math.floor(i / Math.floor(editorRect.width / fontSize));
          const col = i % Math.floor(editorRect.width / fontSize);
          x = editorRect.left + col * fontSize;
          y = editorRect.top + row * lineHeight;
        }

        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        overlay.appendChild(el);
        charEls.push(el);
      }

      // ── Compute animation variables ──
      const screenCX = window.innerWidth / 2;
      const screenCY = window.innerHeight / 2;
      const jarCY = screenCY + 40;
      const jarRadius = 30;
      const total = charEls.length;

      // 70% will fade out
      const shuffled = [...charEls].sort(() => Math.random() - 0.5);
      const fadeChars = new Set(shuffled.slice(0, Math.floor(total * 0.7)));

      for (const [i, el] of charEls.entries()) {
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;

        const dx = cx - screenCX;
        const dy = cy - screenCY;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = dx / dist;
        const ny = dy / dist;

        // Scatter
        const scatterMag = 300 + Math.random() * 500;
        const sx = nx * scatterMag + (Math.random() - 0.5) * 200;
        const sy = ny * scatterMag + (Math.random() - 0.5) * 200;
        const sr = (Math.random() - 0.5) * 720;

        // Condense (circle in jar)
        const angle = (i / total) * Math.PI * 2;
        const r = jarRadius + (Math.random() - 0.5) * 20;
        const circleX = Math.cos(angle) * r;
        const circleY = Math.sin(angle) * r;
        const circleRot = (angle * 180) / Math.PI + (Math.random() - 0.5) * 30;

        // Float
        const floatDx = (Math.random() - 0.5) * 20;
        const floatDy = (Math.random() - 0.5) * 20;
        const fx = screenCX - cx + circleX + floatDx;
        const fy = jarCY - cy + circleY + floatDy;
        const fr = (Math.random() - 0.5) * 30;

        const fdur = 3 + Math.random() * 4;
        const fdel = Math.random() * 2;

        el.style.setProperty('--tx', `${sx}px`);
        el.style.setProperty('--ty', `${sy}px`);
        el.style.setProperty('--r', `${sr}deg`);
        el.style.setProperty('--cx', `${screenCX - cx + circleX}px`);
        el.style.setProperty('--cy', `${jarCY - cy + circleY}px`);
        el.style.setProperty('--cr', `${circleRot}deg`);
        el.style.setProperty('--fx', `${fx}px`);
        el.style.setProperty('--fy', `${fy}px`);
        el.style.setProperty('--fr', `${fr}deg`);

        const innerEl = el.querySelector('.st-char-inner');
        if (innerEl instanceof HTMLElement) {
          innerEl.style.setProperty('--fdur', `${fdur}s`);
          innerEl.style.setProperty('--fdel', `-${fdel}s`);
        }
      }

      // ── Animation timeline ──

      // Phase 1 (0s): Scatter
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          overlay.classList.add('phase-scatter');
        });
      });

      // Phase 2 (1.5s): Resolve — caller navigates to jar
      setTimeout(() => resolve(), 1500);

      // Phase 3 (2s): Condense
      setTimeout(() => {
        overlay.classList.remove('phase-scatter');
        overlay.classList.add('phase-condense');
      }, 2000);

      // Phase 4 (3.5s): Float — 70% fade out
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

      // Phase 5 (6.5s): Cleanup
      setTimeout(() => {
        overlay.style.transition = 'opacity 1.5s ease';
        overlay.style.opacity = '0';
        setTimeout(() => {
          overlay.classList.remove('active', 'phase-scatter', 'phase-condense', 'phase-float');
          overlay.style.opacity = '';
          overlay.style.transition = '';
          overlay.innerHTML = '';
          runningRef.current = false;
        }, 1500);
      }, 6500);
    });
  }, []);

  return run;
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
