'use client';

import { useEffect, useRef } from 'react';

/**
 * 圧力にじみエフェクト
 *
 * キーの長押し時間やIME入力中のポーズに応じて、文字にインクの「にじみ」を
 * text-shadow で表現する。長く押すほど intensity が高くなり、shadow が
 * 濃く/多くなる。
 *
 * - 直接入力: keydown〜keyup の hold 時間を計測
 * - IME入力: keydown 間の pause 時間をログし、確定文字にマッピング
 * - intensity: BASE 0.18, 閾値超過分で最大 +0.60 (合計 0.78)
 */

const HOLD_THRESHOLD_MS = 100;
const PAUSE_THRESHOLD_MS = 150;
const BASE_INTENSITY = 0.18;
const MAX_ADDED = 0.6;

function seededRng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function calcIntensity(ms: number, threshold: number): number {
  if (ms <= threshold) return BASE_INTENSITY;
  const added = Math.min(MAX_ADDED, (ms - threshold) / 800);
  return BASE_INTENSITY + added;
}

function generateBleedShadow(intensity: number, seed: number): string {
  if (intensity < 0.01) return 'none';
  const rng = seededRng(seed);
  const biasAngle = rng() * Math.PI * 2;
  const biasDx = Math.cos(biasAngle);
  const biasDy = Math.sin(biasAngle);
  const numLayers = Math.floor(4 + intensity * 10);
  const shadows: string[] = [];

  for (let i = 0; i < numLayers; i++) {
    const angle = rng() * Math.PI * 2;
    const dist = rng() * intensity * 1.0;
    const ox = dist * Math.cos(angle) + biasDx * intensity * 0.3 * rng();
    const oy = dist * Math.sin(angle) + biasDy * intensity * 0.3 * rng();
    const blur = 0.2 + rng() * rng() * intensity * 2.5;
    const r = 40 + Math.floor(rng() * 30);
    const g = 30 + Math.floor(rng() * 25);
    const b = 20 + Math.floor(rng() * 20);
    const alpha = (0.02 + rng() * intensity * 0.15).toFixed(3);
    shadows.push(
      `${ox.toFixed(2)}px ${oy.toFixed(2)}px ${blur.toFixed(1)}px rgba(${r},${g},${b},${alpha})`,
    );
  }
  if (intensity > 0.4) {
    const poolBlur = (2 + intensity * 4).toFixed(1);
    const poolAlpha = ((intensity - 0.4) * 0.15).toFixed(3);
    const poolOx = (biasDx * intensity * 0.2).toFixed(2);
    const poolOy = (biasDy * intensity * 0.2).toFixed(2);
    shadows.push(`${poolOx}px ${poolOy}px ${poolBlur}px rgba(50,40,30,${poolAlpha})`);
  }
  return shadows.join(', ');
}

function applyBleedStyle(span: HTMLSpanElement) {
  const intensity = Number.parseFloat(span.dataset.intensity ?? '0');
  const seed = Number.parseInt(span.dataset.seed ?? '0', 10);
  if (intensity < 0.01) {
    span.style.textShadow = 'none';
    span.style.filter = 'none';
    span.style.letterSpacing = 'normal';
    return;
  }
  span.style.textShadow = generateBleedShadow(intensity, seed);
  const rng = seededRng(seed + 7777);
  const filterBlur = intensity * (0.1 + rng() * 0.15);
  span.style.filter = filterBlur > 0.05 ? `blur(${filterBlur.toFixed(2)}px)` : 'none';
  const ls = intensity * 0.02;
  span.style.letterSpacing = ls > 0.005 ? `${ls.toFixed(3)}em` : 'normal';
}

function wrapWithBleed(text: string, charMsArray: number[], threshold: number) {
  const sel = window.getSelection();
  if (!sel?.rangeCount) return;
  const range = sel.getRangeAt(0);
  const node = range.startContainer;
  const offset = range.startOffset;

  let targetNode: Node | null = null;
  let targetEnd = -1;

  if (node.nodeType === Node.TEXT_NODE) {
    const full = node.textContent ?? '';
    const end = offset;
    const start = end - text.length;
    if (start >= 0 && full.substring(start, end) === text) {
      targetNode = node;
      targetEnd = end;
    }
  } else if (node.nodeType === Node.ELEMENT_NODE && offset > 0) {
    const prev = node.childNodes[offset - 1];
    if (prev?.nodeType === Node.TEXT_NODE && prev.textContent?.endsWith(text)) {
      targetNode = prev;
      targetEnd = prev.textContent!.length;
    }
  }

  if (!targetNode) return;

  const full = targetNode.textContent ?? '';
  const textStart = targetEnd - text.length;
  const before = full.substring(0, textStart);
  const after = full.substring(targetEnd);
  const frag = document.createDocumentFragment();
  if (before) frag.appendChild(document.createTextNode(before));

  let plainBuf = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const ms = charMsArray[i] ?? 0;
    const intensity = calcIntensity(ms, threshold);

    if (intensity > BASE_INTENSITY + 0.01) {
      if (plainBuf) {
        frag.appendChild(document.createTextNode(plainBuf));
        plainBuf = '';
      }
      const span = document.createElement('span');
      span.className = 'eblock';
      span.dataset.intensity = intensity.toFixed(4);
      span.dataset.seed = String(Math.floor(Math.random() * 99999));
      span.dataset.mode = 'pressureBleed';
      span.textContent = ch;
      applyBleedStyle(span);
      frag.appendChild(span);
    } else {
      plainBuf += ch;
    }
  }
  if (plainBuf) frag.appendChild(document.createTextNode(plainBuf));

  const cursorAnchor = document.createTextNode('\u200B');
  frag.appendChild(cursorAnchor);
  if (after) frag.appendChild(document.createTextNode(after));

  targetNode.parentNode?.replaceChild(frag, targetNode);

  const newRange = document.createRange();
  newRange.setStart(cursorAnchor, 1);
  newRange.collapse(true);
  sel.removeAllRanges();
  sel.addRange(newRange);
}

function mapPausesToCharPressures(pauseLog: { pauseMs: number }[], charCount: number): number[] {
  if (pauseLog.length === 0 || charCount === 0) return new Array(charCount).fill(0);
  const maxHolds = new Array(charCount).fill(0);
  for (let i = 0; i < pauseLog.length; i++) {
    const ratio = i / Math.max(1, pauseLog.length - 1);
    const idx = Math.min(Math.floor(ratio * charCount), charCount - 1);
    maxHolds[idx] = Math.max(maxHolds[idx], pauseLog[i].pauseMs);
  }
  return maxHolds;
}

const MODIFIER_KEYS = new Set([
  'Shift',
  'Control',
  'Alt',
  'Meta',
  'CapsLock',
  'Tab',
  'Escape',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'F1',
  'F2',
  'F3',
  'F4',
  'F5',
  'F6',
  'F7',
  'F8',
  'F9',
  'F10',
  'F11',
  'F12',
]);

function isModifier(e: KeyboardEvent): boolean {
  return e.ctrlKey || e.metaKey || e.altKey || MODIFIER_KEYS.has(e.key);
}

export function usePressureBleed(
  editorRef: React.RefObject<HTMLDivElement | null>,
  enabled: boolean,
) {
  const composingRef = useRef(false);
  const imePauseLogRef = useRef<{ pauseMs: number }[]>([]);
  const lastImeTimeRef = useRef(0);
  const directKeyRef = useRef<{ key: string; downAt: number } | null>(null);
  const directCharRef = useRef<string | null>(null);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !enabled) return;

    function onKeyDown(e: KeyboardEvent) {
      if (document.activeElement !== editor) return;
      const isMod = isModifier(e);
      const isControl = e.key === 'Backspace' || e.key === 'Delete' || e.key === 'Enter';

      if (e.repeat && !isMod && !isControl) {
        // Long-press detected — wrap last char with live intensity
        e.preventDefault();
        if (directCharRef.current) {
          const holdMs = Date.now() - (directKeyRef.current?.downAt ?? Date.now());
          const ch = directCharRef.current;
          directCharRef.current = null;
          directKeyRef.current = null;
          requestAnimationFrame(() => wrapWithBleed(ch, [holdMs], HOLD_THRESHOLD_MS));
        }
        return;
      }

      if (composingRef.current) {
        if (!isMod) {
          const now = Date.now();
          const pauseMs = now - lastImeTimeRef.current;
          imePauseLogRef.current.push({ pauseMs });
          lastImeTimeRef.current = now;
        }
      } else if (!isMod && !isControl) {
        directKeyRef.current = { key: e.key, downAt: Date.now() };
      }
    }

    function onKeyUp(e: KeyboardEvent) {
      if (directKeyRef.current?.key === e.key && directCharRef.current) {
        const holdMs = Date.now() - directKeyRef.current.downAt;
        const ch = directCharRef.current;
        directKeyRef.current = null;
        directCharRef.current = null;
        if (holdMs > HOLD_THRESHOLD_MS) {
          requestAnimationFrame(() => wrapWithBleed(ch, [holdMs], HOLD_THRESHOLD_MS));
        }
      } else if (directKeyRef.current?.key === e.key) {
        directKeyRef.current = null;
      }
    }

    function onInput(e: Event) {
      if (composingRef.current) return;
      const ie = e as InputEvent;
      if (ie.inputType === 'insertText' && ie.data && directKeyRef.current) {
        directCharRef.current = ie.data;
      }
    }

    function onCompositionStart() {
      composingRef.current = true;
      imePauseLogRef.current = [];
      lastImeTimeRef.current = Date.now();
    }

    function onCompositionEnd(e: Event) {
      composingRef.current = false;
      const text = (e as CompositionEvent).data;
      if (!text) {
        imePauseLogRef.current = [];
        return;
      }

      const now = Date.now();
      imePauseLogRef.current.push({ pauseMs: now - lastImeTimeRef.current });
      const charMsArray = mapPausesToCharPressures(imePauseLogRef.current, text.length);
      imePauseLogRef.current = [];

      const hasBleed = charMsArray.some(
        (ms) => calcIntensity(ms, PAUSE_THRESHOLD_MS) > BASE_INTENSITY + 0.01,
      );
      if (hasBleed) {
        requestAnimationFrame(() => wrapWithBleed(text, charMsArray, PAUSE_THRESHOLD_MS));
      }
    }

    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    editor.addEventListener('input', onInput);
    editor.addEventListener('compositionstart', onCompositionStart);
    editor.addEventListener('compositionend', onCompositionEnd);

    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      editor.removeEventListener('input', onInput);
      editor.removeEventListener('compositionstart', onCompositionStart);
      editor.removeEventListener('compositionend', onCompositionEnd);
    };
  }, [editorRef, enabled]);
}
