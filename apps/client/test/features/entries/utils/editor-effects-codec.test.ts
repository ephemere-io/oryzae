import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  applyTextSpansToEditor,
  extractEditorEffects,
} from '@/features/entries/utils/editor-effects-codec';

describe('editor-effects-codec', () => {
  let editor: HTMLDivElement;

  beforeEach(() => {
    editor = document.createElement('div');
    editor.contentEditable = 'true';
    document.body.appendChild(editor);
  });

  afterEach(() => {
    editor.remove();
  });

  describe('extractEditorEffects', () => {
    it('returns null when there are no spans and no traces', () => {
      editor.textContent = 'plain text';
      expect(extractEditorEffects(editor, undefined)).toBeNull();
      expect(extractEditorEffects(editor, [])).toBeNull();
    });

    it('extracts a fontSize eblock span at the right character offset', () => {
      // The hook writes the resolved px size; we save what we see.
      editor.innerHTML =
        'ab<span class="eblock" data-mode="fontSize" style="font-size: 20px">c</span>de';

      const state = extractEditorEffects(editor, undefined);
      expect(state?.textSpans).toEqual([
        { kind: 'time', start: 2, end: 3, mode: 'fontSize', fontSize: 20 },
      ]);
    });

    it('extracts a fontWeight eblock span', () => {
      editor.innerHTML =
        'ab<span class="eblock" data-mode="fontWeight" style="font-weight: 500">c</span>de';

      const state = extractEditorEffects(editor, undefined);
      expect(state?.textSpans).toEqual([
        { kind: 'time', start: 2, end: 3, mode: 'fontWeight', fontWeight: 500 },
      ]);
    });

    it('extracts a pressureBleed eblock span', () => {
      editor.innerHTML =
        'x<span class="eblock" data-mode="pressureBleed" data-intensity="0.4500" data-seed="123">y</span>';

      const state = extractEditorEffects(editor, undefined);
      expect(state?.textSpans).toEqual([
        { kind: 'pressure', start: 1, end: 2, intensity: 0.45, seed: 123 },
      ]);
    });

    it('extracts a v-block (voice) span with fontSize in em', () => {
      editor.innerHTML = 'pre <span class="v-block" style="font-size: 2.50em">声</span> post';

      const state = extractEditorEffects(editor, undefined);
      expect(state?.textSpans).toEqual([{ kind: 'voice', start: 4, end: 5, fontSizeEm: 2.5 }]);
    });

    it('counts <br> as one newline and <div> boundaries as newlines', () => {
      // mimic what contentEditable produces: text + <div>more</div>
      editor.innerHTML =
        'a<br>b<div>c<span class="eblock" data-mode="fontSize" style="font-size: 14px">d</span></div>';

      const state = extractEditorEffects(editor, undefined);
      // 'a' (0) + '\n' from <br> (1) + 'b' (2) + '\n' from <div> boundary (3) + 'c' (4)
      // span 'd' starts at 5
      expect(state?.textSpans).toEqual([
        { kind: 'time', start: 5, end: 6, mode: 'fontSize', fontSize: 14 },
      ]);
    });

    it('includes eraserTraces snapshot when provided', () => {
      const traces = [{ rx: 1, ry: 2, w: 3, h: 4, chars: ['a'], intensity: 0.1, seed: 9 }];
      editor.textContent = 'text';
      const state = extractEditorEffects(editor, traces);
      expect(state?.eraserTraces).toEqual(traces);
      // returned traces should be a copy, not the same reference
      expect(state?.eraserTraces?.[0]).not.toBe(traces[0]);
    });
  });

  describe('applyTextSpansToEditor', () => {
    it('wraps the requested character range with an eblock span (fontSize)', () => {
      editor.textContent = 'abcde';

      applyTextSpansToEditor(editor, [
        { kind: 'time', start: 2, end: 3, mode: 'fontSize', fontSize: 24 },
      ]);

      const span = editor.querySelector('span.eblock') as HTMLElement | null;
      expect(span?.textContent).toBe('c');
      expect(span?.getAttribute('data-mode')).toBe('fontSize');
      expect(span?.style.fontSize).toBe('24px');
    });

    it('wraps with a fontWeight eblock span', () => {
      editor.textContent = 'abcde';

      applyTextSpansToEditor(editor, [
        { kind: 'time', start: 2, end: 3, mode: 'fontWeight', fontWeight: 600 },
      ]);

      const span = editor.querySelector('span.eblock') as HTMLElement | null;
      expect(span?.textContent).toBe('c');
      expect(span?.getAttribute('data-mode')).toBe('fontWeight');
      expect(span?.style.fontWeight).toBe('600');
    });

    it('wraps a voice span', () => {
      editor.textContent = 'hello';
      applyTextSpansToEditor(editor, [{ kind: 'voice', start: 0, end: 5, fontSizeEm: 3 }]);
      const span = editor.querySelector('span.v-block');
      expect(span?.textContent).toBe('hello');
      const style = (span as HTMLElement | null)?.style.fontSize;
      // jsdom normalizes "3.00em" → "3em"; just check that font-size is set
      expect(style).toMatch(/^3(\.\d+)?em$/);
    });

    it('applies multiple non-overlapping spans in order', () => {
      editor.textContent = '123456';
      applyTextSpansToEditor(editor, [
        { kind: 'time', start: 0, end: 1, mode: 'fontSize', fontSize: 18 },
        { kind: 'pressure', start: 4, end: 5, intensity: 0.5, seed: 7 },
      ]);
      const spans = editor.querySelectorAll('span.eblock');
      expect(spans).toHaveLength(2);
      expect(spans[0].textContent).toBe('1');
      expect(spans[1].textContent).toBe('5');
    });

    it('round-trips extract → apply → extract — fontSize survives the editor base size', () => {
      // The span was rendered at 22.4px (e.g. baseFontSize=16 × scale=1.4 at write time).
      editor.innerHTML =
        'ab<span class="eblock" data-mode="fontSize" style="font-size: 22.4px">c</span><span class="eblock" data-mode="pressureBleed" data-intensity="0.6200" data-seed="42">d</span>e';
      const state = extractEditorEffects(editor, undefined);
      expect(state?.textSpans).toHaveLength(2);

      // Restore into an editor with a *different* base font size — the span
      // must still render at 22.4px (regression test for Issue #332 v2 where
      // we previously hardcoded 16 as the base).
      const rebuilt = document.createElement('div');
      rebuilt.style.fontSize = '14px';
      rebuilt.textContent = 'abcde';
      applyTextSpansToEditor(rebuilt, state?.textSpans ?? []);

      const restoredFontSize = rebuilt.querySelector<HTMLElement>(
        'span.eblock[data-mode="fontSize"]',
      )?.style.fontSize;
      expect(restoredFontSize).toBe('22.4px');

      const round2 = extractEditorEffects(rebuilt, undefined);
      expect(round2?.textSpans).toEqual(state?.textSpans);
    });

    it('silently skips invalid (start >= end) marks', () => {
      editor.textContent = 'abc';
      applyTextSpansToEditor(editor, [
        { kind: 'time', start: 2, end: 2, mode: 'fontSize', fontSize: 16 },
      ]);
      expect(editor.querySelector('span.eblock')).toBeNull();
    });
  });
});
