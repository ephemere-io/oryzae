/**
 * 「見える」act ドライバ。runner.ts の makeActContext と同じ ActContext 形だが、
 * 人間が replay を観ていて動作を目で追えるよう、わざと遅く・演出付きにする:
 *
 *  - type()  → 1文字ずつ、キーストロークごとに遅延
 *  - click() → 対象にハイライトリングを出してからクリック
 *  - どちらも onAction() で実況を返す → ステージ下に「⌨ typing …」「👆 click …」を表示できる
 *
 * これを使うのは可視ハーネス（ReplayPage）だけ。CI / runAll / dashboard の "Run all" は
 * runner.ts の即時ドライバのまま（速度が要る・演出は不要）。
 */

import type { ActContext } from '../core/types';

interface VisibleActOptions {
  /** 1文字あたりのタイプ遅延（ms）。 */
  keystrokeMs?: number;
  /** クリック前にハイライトリングを保持する時間（ms）。 */
  clickHoldMs?: number;
  /** アクション開始/終了で呼ばれる。null で実況をクリア。 */
  onAction?: (label: string | null) => void;
  /** await の合間に呼ばれる。true を返すと早期中断（step がキャンセルされた）。 */
  isCancelled?: () => boolean;
}

export function makeVisibleActContext(root: HTMLElement, opts: VisibleActOptions = {}): ActContext {
  const keystrokeMs = opts.keystrokeMs ?? 60;
  const clickHoldMs = opts.clickHoldMs ?? 220;
  const onAction = opts.onAction ?? (() => {});
  const isCancelled = opts.isCancelled ?? (() => false);

  return {
    root,

    async click(selector) {
      const el = root.querySelector<HTMLElement>(selector);
      if (!el) throw new Error(`act.click: no element matching "${selector}"`);
      onAction(`👆 click ${shorten(selector)}`);
      el.scrollIntoView({ block: 'nearest' });
      const ring = highlight(el);
      await wait(clickHoldMs);
      ring.remove();
      if (isCancelled()) return onAction(null);
      el.click();
      await wait(80);
      onAction(null);
    },

    async type(selector, text) {
      const el = root.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector);
      if (!el) throw new Error(`act.type: no element matching "${selector}"`);
      onAction(`⌨ typing "${truncate(text, 40)}"`);
      el.scrollIntoView({ block: 'nearest' });
      el.focus();
      const ring = highlight(el, true);
      // React の onChange を発火させるためネイティブ setter 経由で値を設定する。
      const proto = Object.getPrototypeOf(el);
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      let acc = '';
      for (const ch of text) {
        if (isCancelled()) break;
        acc += ch;
        setter?.call(el, acc);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        await wait(keystrokeMs);
      }
      ring.remove();
      onAction(null);
    },

    wait(ms) {
      onAction(`⏳ wait ${ms}ms`);
      return wait(ms).then(() => onAction(null));
    },
  };
}

/* ----------------------------- helpers ----------------------------- */

function wait(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function shorten(selector: string) {
  return selector.length > 40 ? `${selector.slice(0, 37)}…` : selector;
}

function truncate(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

/**
 * `el` の上にハイライトリングを描く。呼び出し側が `.remove()` する責務を持つ。
 * `position: fixed` なので overflow/scroll に関係なくステージ上に浮く。
 */
function highlight(el: HTMLElement, soft = false): HTMLElement {
  const rect = el.getBoundingClientRect();
  const ring = document.createElement('div');
  ring.className = `verify-act-ring${soft ? ' soft' : ''}`;
  ring.style.position = 'fixed';
  ring.style.left = `${rect.left - 4}px`;
  ring.style.top = `${rect.top - 4}px`;
  ring.style.width = `${rect.width + 8}px`;
  ring.style.height = `${rect.height + 8}px`;
  ring.style.pointerEvents = 'none';
  ring.style.zIndex = '9999';
  document.body.appendChild(ring);
  // CSS トランジションを発火させるため reflow を強制する。
  void ring.offsetWidth;
  ring.classList.add('on');
  return ring;
}
