import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  type EditorSettings,
} from '@/features/entries/components/settings-drawer';
import { useGhostEffect } from '@/features/entries/hooks/use-ghost-effect';

function makeSettings(patch: Partial<EditorSettings>): EditorSettings {
  return { ...DEFAULT_SETTINGS, ...patch, ghostEnabled: true };
}

function dispatchInsertText(editor: HTMLElement, data: string) {
  const ev = new Event('input', { bubbles: true });
  Object.defineProperty(ev, 'inputType', { value: 'insertText' });
  Object.defineProperty(ev, 'data', { value: data });
  editor.dispatchEvent(ev);
}

describe('useGhostEffect', () => {
  let editorEl: HTMLDivElement;
  let layerEl: HTMLDivElement;
  let editorRef: { current: HTMLDivElement | null };
  let layerRef: { current: HTMLDivElement | null };

  beforeEach(() => {
    // jsdom doesn't implement Range.getClientRects; stub to return a usable rect.
    const fakeRect: DOMRect = {
      x: 100,
      y: 200,
      left: 100,
      top: 200,
      right: 120,
      bottom: 220,
      width: 20,
      height: 20,
      toJSON: () => ({}),
    };
    // @type-assertion-allowed: DOMRectList has no public constructor; jsdom polyfill substitutes an array.
    const rectList = [fakeRect] as unknown as DOMRectList;
    Range.prototype.getClientRects = () => rectList;
    Range.prototype.getBoundingClientRect = () => fakeRect;

    editorEl = document.createElement('div');
    editorEl.contentEditable = 'true';
    layerEl = document.createElement('div');
    document.body.append(editorEl, layerEl);
    editorRef = { current: editorEl };
    layerRef = { current: layerEl };

    editorEl.textContent = 'x';
    const range = document.createRange();
    range.selectNodeContents(editorEl);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  });

  afterEach(() => {
    editorEl.remove();
    layerEl.remove();
    for (const s of document.head.querySelectorAll('style')) {
      s.remove();
    }
  });

  it('spawns ghost with vertical writing-mode when editor is vertical', () => {
    const settings = makeSettings({ writingMode: 'vertical', ghostMode: 'dust' });
    renderHook(() => useGhostEffect(editorRef, layerRef, settings));

    dispatchInsertText(editorEl, 'あ');

    const ghost = layerEl.querySelector<HTMLDivElement>('.ghost-dust');
    expect(ghost).not.toBeNull();
    expect(ghost?.style.writingMode).toBe('vertical-rl');
    expect(ghost?.style.textOrientation).toBe('mixed');
  });

  it('spawns ghost with horizontal writing-mode when editor is horizontal', () => {
    const settings = makeSettings({ writingMode: 'horizontal', ghostMode: 'dust' });
    renderHook(() => useGhostEffect(editorRef, layerRef, settings));

    dispatchInsertText(editorEl, 'a');

    const ghost = layerEl.querySelector<HTMLDivElement>('.ghost-dust');
    expect(ghost).not.toBeNull();
    expect(ghost?.style.writingMode).toBe('horizontal-tb');
  });
});
