'use client';

import { useEffect, useRef } from 'react';

/**
 * 消し跡エフェクト
 *
 * 文字を削除すると、その位置に薄いブラーのかかった「残像」が Canvas 上に描画される。
 * 同じ位置で繰り返し削除すると intensity が増す (BASE 0.07 → MAX 0.22)。
 * 各残像はシード付きランダムのスケッチ線で装飾される。
 */

interface Trace {
  rx: number;
  ry: number;
  w: number;
  h: number;
  chars: string[];
  intensity: number;
  seed: number;
}

interface PendingDel {
  rx: number;
  ry: number;
  w: number;
  h: number;
  char: string;
}

const BASE = 0.07;
const INC = 0.04;
const MAX_INTENSITY = 0.22;
const OVERLAP_PX = 8;

function seededRng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function generateSmudge(char: string, seed: number, fontSize: number): HTMLCanvasElement {
  const pad = 6;
  const sz = Math.ceil(fontSize * 1.4) + pad * 2;
  const c = document.createElement('canvas');
  c.width = sz;
  c.height = sz;
  const cx = c.getContext('2d');
  if (!cx) return c;

  cx.filter = 'blur(3px)';
  cx.font = `${fontSize}px sans-serif`;
  cx.fillStyle = 'rgba(140,140,140,1)';
  cx.textBaseline = 'middle';
  cx.textAlign = 'center';
  cx.fillText(char, sz / 2, sz / 2);

  cx.filter = 'blur(1px)';
  const rng = seededRng(seed);
  const n = 3 + Math.floor(rng() * 4);
  cx.strokeStyle = 'rgba(160,160,160,0.6)';
  for (let i = 0; i < n; i++) {
    cx.lineWidth = 0.5 + rng() * 1.5;
    cx.beginPath();
    const sx = sz * 0.2 + rng() * sz * 0.6;
    const sy = sz * 0.2 + rng() * sz * 0.6;
    cx.moveTo(sx, sy);
    cx.quadraticCurveTo(
      sx + (rng() - 0.5) * sz * 0.5,
      sy + (rng() - 0.5) * sz * 0.3,
      sx + (rng() - 0.5) * sz * 0.6,
      sy + (rng() - 0.5) * sz * 0.4,
    );
    cx.stroke();
  }
  return c;
}

function lastTextNode(el: Node | null): Text | null {
  if (!el) return null;
  // @type-assertion-allowed: nodeType check guarantees Text node but TS DOM types lack narrowing
  if (el.nodeType === Node.TEXT_NODE) return el as Text;
  for (let i = el.childNodes.length - 1; i >= 0; i--) {
    const r = lastTextNode(el.childNodes[i]);
    if (r) return r;
  }
  return null;
}

function charRangeBefore(sel: Selection): Range | null {
  const r = sel.getRangeAt(0);
  if (!r.collapsed) return r.cloneRange();
  const node = r.startContainer;
  const off = r.startOffset;
  const cr = document.createRange();
  if (node.nodeType === Node.TEXT_NODE && off > 0) {
    cr.setStart(node, off - 1);
    cr.setEnd(node, off);
    return cr;
  }
  if (node.nodeType === Node.ELEMENT_NODE && off > 0) {
    const prev = node.childNodes[off - 1];
    if (prev?.nodeType === Node.TEXT_NODE) {
      const len = (prev.textContent ?? '').length;
      if (len > 0) {
        cr.setStart(prev, len - 1);
        cr.setEnd(prev, len);
        return cr;
      }
    }
    const last = lastTextNode(prev);
    if (last && (last.textContent ?? '').length > 0) {
      const len = last.textContent!.length;
      cr.setStart(last, len - 1);
      cr.setEnd(last, len);
      return cr;
    }
  }
  return null;
}

export function useEraserTrace(
  editorRef: React.RefObject<HTMLDivElement | null>,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  enabled: boolean,
  fontSize: number,
) {
  const tracesRef = useRef<Trace[]>([]);
  const pendingRef = useRef<PendingDel | null>(null);
  const smudgeCacheRef = useRef(new Map<string, HTMLCanvasElement>());
  const redrawQueuedRef = useRef(false);

  useEffect(() => {
    const editor = editorRef.current;
    const canvas = canvasRef.current;
    if (!editor || !canvas || !enabled) {
      // Clear canvas when disabled
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    // Resize canvas to match editor
    function resizeCanvas() {
      if (!canvas || !editor) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = editor.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    }
    resizeCanvas();

    function getSmudge(char: string, seed: number): HTMLCanvasElement {
      const key = `${char}_${seed}`;
      const cached = smudgeCacheRef.current.get(key);
      if (cached) return cached;
      const s = generateSmudge(char, seed, fontSize);
      smudgeCacheRef.current.set(key, s);
      return s;
    }

    function draw() {
      redrawQueuedRef.current = false;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cw = canvas.width / dpr;
      const ch = canvas.height / dpr;
      ctx.clearRect(0, 0, cw, ch);

      const traces = tracesRef.current;
      if (traces.length === 0) return;

      const sz = Math.ceil(fontSize * 1.4) + 12;
      for (const t of traces) {
        if (t.rx < -sz || t.ry < -sz || t.rx > cw + sz || t.ry > ch + sz) continue;
        for (const c of t.chars) {
          const smudge = getSmudge(c, t.seed);
          ctx.globalAlpha = t.intensity;
          ctx.drawImage(smudge, t.rx + t.w / 2 - sz / 2, t.ry + t.h / 2 - sz / 2, sz, sz);
        }
      }
      ctx.globalAlpha = 1;
    }

    function requestRedraw() {
      if (redrawQueuedRef.current) return;
      redrawQueuedRef.current = true;
      requestAnimationFrame(draw);
    }

    function capturePos(charRange: Range) {
      const rect = charRange.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return null;
      const editorRect = editor!.getBoundingClientRect();
      return {
        rx: rect.left - editorRect.left,
        ry: rect.top - editorRect.top,
        w: rect.width,
        h: rect.height,
      };
    }

    function onBeforeInput(e: Event) {
      // @type-assertion-allowed: beforeinput event is InputEvent but TS types it as Event
      const ie = e as InputEvent;
      const tp = ie.inputType;
      if (tp !== 'deleteContentBackward' && tp !== 'deleteContentForward' && tp !== 'deleteByCut')
        return;
      const sel = window.getSelection();
      if (!sel?.rangeCount) return;
      const charRange = tp === 'deleteContentBackward' ? charRangeBefore(sel) : null;
      if (!charRange) return;
      const text = charRange.toString();
      if (!text || text === '\n' || text === '\r\n') return;
      const pos = capturePos(charRange);
      if (!pos) return;
      pendingRef.current = { rx: pos.rx, ry: pos.ry, w: pos.w, h: pos.h, char: text.charAt(0) };
    }

    function onInput() {
      const del = pendingRef.current;
      pendingRef.current = null;
      if (!del) return;

      const traces = tracesRef.current;
      const nearby = traces.find(
        (t) => Math.abs(t.rx - del.rx) < OVERLAP_PX && Math.abs(t.ry - del.ry) < OVERLAP_PX,
      );
      if (nearby) {
        nearby.chars.push(del.char);
        nearby.intensity = Math.min(nearby.intensity + INC, MAX_INTENSITY);
      } else {
        traces.push({
          rx: del.rx,
          ry: del.ry,
          w: del.w,
          h: del.h,
          chars: [del.char],
          intensity: BASE,
          seed: Math.floor(Math.random() * 99999),
        });
      }
      requestRedraw();
    }

    editor.addEventListener('beforeinput', onBeforeInput);
    editor.addEventListener('input', onInput);
    editor.addEventListener('scroll', requestRedraw);
    window.addEventListener('resize', resizeCanvas);

    return () => {
      editor.removeEventListener('beforeinput', onBeforeInput);
      editor.removeEventListener('input', onInput);
      editor.removeEventListener('scroll', requestRedraw);
      window.removeEventListener('resize', resizeCanvas);
      smudgeCacheRef.current.clear();
    };
  }, [editorRef, canvasRef, enabled, fontSize]);
}
