'use client';

import { useEffect, useRef } from 'react';
import type {
  EditorSettings,
  TimeInscriptionMode,
} from '@/features/entries/components/settings-drawer';

/**
 * 時間内包エフェクト
 *
 * 入力の間隔（タイピング速度）に応じて文字のスタイルが変化する。
 * 速い入力 → 小さい/軽い文字、遅い入力 → 大きい/重い文字。
 * 文字を <span class="eblock"> で包み、data-t に入力速度パラメータを格納する。
 */

const FS_MIN = 0.8;
const FS_MAX = 1.35;
const FW_MIN = 300;
const FW_MAX = 700;
const FLUSH_DELAY_MS = 350;

function calcT(ms: number): number {
  const sec = ms / 1000;
  return Math.max(0, Math.min(1, Math.log2(1 + sec) / Math.log2(16)));
}

function applyStyle(
  span: HTMLSpanElement,
  t: number,
  mode: TimeInscriptionMode,
  baseFontSize: number,
) {
  if (mode === 'fontWeight') {
    span.style.fontWeight = String(Math.round(FW_MIN + (FW_MAX - FW_MIN) * t));
    span.style.fontSize = `${baseFontSize}px`;
  } else {
    const scale = FS_MIN + (FS_MAX - FS_MIN) * t;
    span.style.fontSize = `${(baseFontSize * scale).toFixed(1)}px`;
    span.style.fontWeight = '400';
  }
}

function createEBlock(
  text: string,
  t: number,
  durationMs: number,
  mode: TimeInscriptionMode,
  baseFontSize: number,
): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = 'eblock';
  span.dataset.t = t.toFixed(4);
  span.dataset.duration = String(durationMs);
  span.dataset.mode = mode;
  span.textContent = text;
  applyStyle(span, t, mode, baseFontSize);
  return span;
}

function wrapText(
  text: string,
  t: number,
  durationMs: number,
  mode: TimeInscriptionMode,
  baseFontSize: number,
) {
  const sel = window.getSelection();
  if (!sel?.rangeCount) return;
  const range = sel.getRangeAt(0);
  const node = range.startContainer;
  const offset = range.startOffset;

  if (node.nodeType === Node.TEXT_NODE) {
    const full = node.textContent ?? '';
    const end = offset;
    const start = end - text.length;
    if (start < 0 || full.substring(start, end) !== text) return;

    const before = full.substring(0, start);
    const after = full.substring(end);
    const span = createEBlock(text, t, durationMs, mode, baseFontSize);

    const parent = node.parentNode;
    if (!parent) return;
    const frag = document.createDocumentFragment();
    if (before) frag.appendChild(document.createTextNode(before));
    frag.appendChild(span);
    if (after) frag.appendChild(document.createTextNode(after));
    parent.replaceChild(frag, node);

    const newRange = document.createRange();
    if (after && span.nextSibling) {
      newRange.setStart(span.nextSibling, 0);
    } else {
      newRange.setStartAfter(span);
    }
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);
    return;
  }

  if (node.nodeType === Node.ELEMENT_NODE && offset > 0) {
    const prev = node.childNodes[offset - 1];
    if (prev?.nodeType === Node.TEXT_NODE) {
      const full = prev.textContent ?? '';
      if (full.endsWith(text)) {
        const before = full.substring(0, full.length - text.length);
        const span = createEBlock(text, t, durationMs, mode, baseFontSize);
        if (before) {
          prev.textContent = before;
          node.insertBefore(span, prev.nextSibling);
        } else {
          node.replaceChild(span, prev);
        }
        const newRange = document.createRange();
        newRange.setStartAfter(span);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);
      }
    }
  }
}

export function useTimeInscription(
  editorRef: React.RefObject<HTMLDivElement | null>,
  settings: EditorSettings,
) {
  const bufferRef = useRef<{ char: string; time: number }[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const compStartRef = useRef<number | null>(null);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !settings.timeInscriptionEnabled) return;
    if (settings.timeInscriptionMode === 'pressureBleed') return;

    const mode = settings.timeInscriptionMode;
    const fontSize = settings.fontSize;

    function flush() {
      const chars = bufferRef.current;
      if (chars.length === 0) return;
      bufferRef.current = [];
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      const text = chars.map((c) => c.char).join('');
      const duration = chars.length > 1 ? chars[chars.length - 1].time - chars[0].time : 200;
      const t = calcT(Math.max(duration, 150));
      requestAnimationFrame(() => wrapText(text, t, duration, mode, fontSize));
    }

    function onCompositionStart() {
      flush();
      compStartRef.current = Date.now();
    }

    function onCompositionEnd(e: Event) {
      if (compStartRef.current == null) return;
      const duration = Date.now() - compStartRef.current;
      const text = (e as CompositionEvent).data;
      compStartRef.current = null;
      if (!text) return;
      const t = calcT(duration);
      requestAnimationFrame(() => wrapText(text, t, duration, mode, fontSize));
    }

    function onInput(e: Event) {
      const ie = e as InputEvent;
      if (compStartRef.current != null) return; // composing
      if (ie.inputType === 'insertText' && ie.data) {
        bufferRef.current.push({ char: ie.data, time: Date.now() });
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(flush, FLUSH_DELAY_MS);
      }
      if (ie.inputType === 'insertParagraph' || ie.inputType === 'insertLineBreak') {
        flush();
      }
    }

    function onBeforeInput(e: Event) {
      const ie = e as InputEvent;
      if (ie.inputType?.startsWith('delete')) {
        flush();
      }
    }

    editor.addEventListener('compositionstart', onCompositionStart);
    editor.addEventListener('compositionend', onCompositionEnd);
    editor.addEventListener('input', onInput);
    editor.addEventListener('beforeinput', onBeforeInput);

    return () => {
      editor.removeEventListener('compositionstart', onCompositionStart);
      editor.removeEventListener('compositionend', onCompositionEnd);
      editor.removeEventListener('input', onInput);
      editor.removeEventListener('beforeinput', onBeforeInput);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [editorRef, settings]);
}
