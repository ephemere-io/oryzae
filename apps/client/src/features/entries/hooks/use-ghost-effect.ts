'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { EditorSettings } from '@/features/entries/components/settings-drawer';

function lerp(a: number, b: number, t: number): string {
  return (a + (b - a) * t).toFixed(1);
}

function buildKeyframes(s: EditorSettings): string {
  const bs = s.ghostBlurStart;
  const be = s.ghostBlurEnd;
  const dp = s.ghostDuration / 100;
  const blkDur = (3.2 * dp).toFixed(2);
  const blkCDur = (1.0 * dp).toFixed(2);
  const dustBs = bs * 0.075;
  const dustBe = be * 0.107;
  const dustDur = (0.85 * dp).toFixed(2);
  const dustCDur = (0.6 * dp).toFixed(2);

  return `
    .ghost-block { animation: ghostBlockFade ${blkDur}s ease-out forwards; }
    @keyframes ghostBlockFade {
      0%   { opacity: 0.32; filter: blur(${bs}px); transform: scale(1.0); }
      8%   { opacity: 0.28; filter: blur(${lerp(bs, be, 0.1)}px); }
      30%  { opacity: 0.18; filter: blur(${lerp(bs, be, 0.35)}px); }
      60%  { opacity: 0.08; filter: blur(${lerp(bs, be, 0.65)}px); transform: scale(1.01); }
      100% { opacity: 0; filter: blur(${be}px); transform: scale(1.02); }
    }
    .ghost-block-composing { animation: ghostBlockCFade ${blkCDur}s ease-out forwards; }
    @keyframes ghostBlockCFade {
      0%   { opacity: 0.18; filter: blur(${lerp(bs, be, 0.2)}px); }
      40%  { opacity: 0.10; filter: blur(${lerp(bs, be, 0.5)}px); }
      100% { opacity: 0; filter: blur(${lerp(bs, be, 0.8)}px); transform: scale(1.01); }
    }
    .ghost-dust { animation: ghostDustFade ${dustDur}s ease-out forwards; }
    @keyframes ghostDustFade {
      0%   { opacity: 0.45; filter: blur(${dustBs.toFixed(2)}px); }
      20%  { opacity: 0.35; filter: blur(${lerp(dustBs, dustBe, 0.3)}px); }
      100% { opacity: 0; filter: blur(${dustBe.toFixed(2)}px); transform: scale(0.94); }
    }
    .ghost-dust-composing { animation: ghostDustCFade ${dustCDur}s ease-out forwards; }
    @keyframes ghostDustCFade {
      0%   { opacity: 0.30; filter: blur(${lerp(dustBs, dustBe, 0.4)}px); }
      100% { opacity: 0; filter: blur(${lerp(dustBs, dustBe, 0.8)}px); transform: scale(0.96); }
    }
  `;
}

function getCursorPos(el: HTMLElement, fontSize: number) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return null;
  const range = sel.getRangeAt(0);
  const rects = range.getClientRects();
  const rect = rects.length > 0 ? rects[rects.length - 1] : range.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    const r = el.getBoundingClientRect();
    return { x: r.left + fontSize, y: r.top + fontSize };
  }
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

export function useGhostEffect(
  editorRef: React.RefObject<HTMLDivElement | null>,
  ghostLayerRef: React.RefObject<HTMLDivElement | null>,
  settings: EditorSettings,
) {
  const styleRef = useRef<HTMLStyleElement | null>(null);
  const bufferRef = useRef<string[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const composingRef = useRef(false);

  // Inject / update keyframe CSS
  useEffect(() => {
    if (!settings.ghostEnabled) {
      if (styleRef.current) {
        styleRef.current.remove();
        styleRef.current = null;
      }
      return;
    }
    if (!styleRef.current) {
      styleRef.current = document.createElement('style');
      document.head.appendChild(styleRef.current);
    }
    styleRef.current.textContent = buildKeyframes(settings);
    return () => {
      if (styleRef.current) {
        styleRef.current.remove();
        styleRef.current = null;
      }
    };
  }, [settings]);

  const spawn = useCallback(
    (text: string, pos: { x: number; y: number }, type: 'block' | 'dust', composing: boolean) => {
      const layer = ghostLayerRef.current;
      if (!layer) return;

      const el = document.createElement('div');
      const cls = composing
        ? type === 'block'
          ? 'ghost-block-composing'
          : 'ghost-dust-composing'
        : type === 'block'
          ? 'ghost-block'
          : 'ghost-dust';
      el.className = cls;
      el.textContent = text;

      const fs = settings.fontSize;
      const sizePct = settings.ghostSize / 100;
      const scatterPct = settings.ghostScatter / 100;

      Object.assign(el.style, {
        position: 'absolute',
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
        fontFamily: 'inherit',
        willChange: 'opacity, transform, filter',
        color: 'rgba(0,0,0,0.22)',
      });

      if (type === 'block') {
        const scale = Math.min(8, Math.max(5, 18 / Math.max(text.length, 1)));
        const gfs = fs * scale * sizePct;
        el.style.fontSize = `${gfs}px`;
        el.style.fontWeight = '300';
        const scatter = fs * 6 * scatterPct;
        const rx = (Math.random() - 0.5) * scatter;
        const ry = (Math.random() - 0.5) * scatter;
        const tw = text.length * gfs * 0.55;
        el.style.left = `${pos.x - tw * 0.6 + rx}px`;
        el.style.top = `${pos.y - gfs * 0.65 + ry}px`;
      } else {
        const gfs = fs * 2.5 * sizePct;
        el.style.fontSize = `${gfs}px`;
        el.style.fontWeight = '400';
        const scatter = fs * 3 * scatterPct;
        const rx = (Math.random() - 0.5) * scatter;
        const ry = (Math.random() - 0.5) * scatter;
        el.style.left = `${pos.x - gfs * 0.35 + rx}px`;
        el.style.top = `${pos.y - gfs * 0.55 + ry}px`;
      }

      layer.appendChild(el);

      const dp = settings.ghostDuration / 100;
      const dur = composing
        ? (type === 'block' ? 1000 : 600) * dp
        : (type === 'block' ? 3200 : 850) * dp;
      setTimeout(() => {
        if (el.parentNode) el.remove();
      }, dur + 200);
    },
    [ghostLayerRef, settings],
  );

  const flush = useCallback(() => {
    const buf = bufferRef.current;
    if (buf.length === 0) return;
    const text = buf.join('');
    bufferRef.current = [];
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const editor = editorRef.current;
    if (!editor) return;
    const pos = getCursorPos(editor, settings.fontSize);
    if (pos) spawn(text, pos, 'block', false);
  }, [editorRef, settings, spawn]);

  // Attach event listeners
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !settings.ghostEnabled) return;

    const mode = settings.ghostMode;

    function onInput(e: Event) {
      const ie = e as InputEvent;
      if (composingRef.current) return;
      if (mode === 'block') {
        if (ie.inputType === 'insertText' && ie.data) {
          bufferRef.current.push(ie.data);
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(flush, 400);
        }
        if (ie.inputType === 'insertParagraph' || ie.inputType === 'insertLineBreak') {
          flush();
        }
      } else if (ie.inputType === 'insertText' && ie.data && editor) {
        const pos = getCursorPos(editor, settings.fontSize);
        if (pos) spawn(ie.data, pos, 'dust', false);
      }
    }

    function onBeforeInput(e: Event) {
      const ie = e as InputEvent;
      if (mode === 'block' && ie.inputType?.startsWith('delete')) flush();
    }

    function onCompositionStart() {
      composingRef.current = true;
      if (mode === 'block') flush();
    }

    function onCompositionEnd(e: Event) {
      composingRef.current = false;
      const text = (e as CompositionEvent).data;
      if (!text) return;
      requestAnimationFrame(() => {
        if (!editor) return;
        const pos = getCursorPos(editor, settings.fontSize);
        if (!pos) return;
        if (mode === 'block') {
          spawn(text, pos, 'block', false);
        } else {
          for (let i = 0; i < text.length; i++) {
            setTimeout(() => spawn(text[i], pos, 'dust', false), i * 60);
          }
        }
      });
    }

    editor.addEventListener('input', onInput);
    editor.addEventListener('beforeinput', onBeforeInput);
    editor.addEventListener('compositionstart', onCompositionStart);
    editor.addEventListener('compositionend', onCompositionEnd);

    return () => {
      editor.removeEventListener('input', onInput);
      editor.removeEventListener('beforeinput', onBeforeInput);
      editor.removeEventListener('compositionstart', onCompositionStart);
      editor.removeEventListener('compositionend', onCompositionEnd);
    };
  }, [editorRef, settings, spawn, flush]);
}
