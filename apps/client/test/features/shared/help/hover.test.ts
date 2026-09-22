import { afterEach, describe, expect, it } from 'vitest';
import { hoverTargetOf, isTypingTarget, labelOf } from '@/features/shared/help/hover';

function mount(html: string): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = html;
  document.body.appendChild(root);
  return root;
}

/** n 番目の要素。無ければ投げる（`as` を使わずに Element を得る）。 */
function nth(root: HTMLElement, selector: string, index: number): Element {
  const el = root.querySelectorAll(selector)[index];
  if (!el) throw new Error(`${selector}[${index}] が無い`);
  return el;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('hoverTargetOf', () => {
  it('自分が話題を名乗っていれば、それだけ（名前で当て直さない）', () => {
    const root = mount('<button data-help="write">書く</button>');
    expect(hoverTargetOf(root.querySelector('button'))).toEqual({ topic: 'write', label: null });
  });

  it('先祖が名乗っていれば、その話題と、押せるものの名前', () => {
    const root = mount('<section data-help="jar"><button>問いを追加</button></section>');
    expect(hoverTargetOf(root.querySelector('button'))).toEqual({
      topic: 'jar',
      label: '問いを追加',
    });
  });

  it('誰も名乗っていなくても、押せるものなら名前を返す', () => {
    const root = mount('<div><a href="/x" aria-label="瓶を開く">→</a></div>');
    expect(hoverTargetOf(root.querySelector('a'))).toEqual({ topic: null, label: '瓶を開く' });
  });

  it('押せるものの中の要素からでも辿れる', () => {
    const root = mount('<button><span>漬ける</span></button>');
    expect(hoverTargetOf(root.querySelector('span'))).toEqual({ topic: null, label: '漬ける' });
  });

  it('話題も押せるものも無ければ null（何にも触れていない）', () => {
    const root = mount('<div><p>ただの文</p></div>');
    expect(hoverTargetOf(root.querySelector('p'))).toBeNull();
    expect(hoverTargetOf(null)).toBeNull();
  });

  it('ヘルプの面の中なら inside-panel', () => {
    const root = mount('<aside data-help-panel><button>閉じる</button></aside>');
    expect(hoverTargetOf(root.querySelector('button'))).toBe('inside-panel');
  });

  it('知らない話題名は名乗っていないのと同じ', () => {
    const root = mount('<div data-help="billing"><button>x</button></div>');
    expect(hoverTargetOf(root.querySelector('button'))).toEqual({ topic: null, label: 'x' });
  });
});

describe('labelOf', () => {
  it('aria-label → title → 文字 の順', () => {
    const root = mount(
      '<button aria-label="A" title="B">C</button><button title="B">C</button><button>  C  D </button>',
    );
    expect(labelOf(nth(root, 'button', 0))).toBe('A');
    expect(labelOf(nth(root, 'button', 1))).toBe('B');
    expect(labelOf(nth(root, 'button', 2))).toBe('C D');
  });

  it('長い文は切る。空なら null', () => {
    const root = mount(`<button>${'あ'.repeat(200)}</button><button>   </button>`);
    expect(labelOf(nth(root, 'button', 0))?.length).toBe(80);
    expect(labelOf(nth(root, 'button', 1))).toBeNull();
  });
});

describe('isTypingTarget', () => {
  it('入力欄・編集領域では true、それ以外は false', () => {
    const root = mount(
      '<input /><textarea></textarea><div contenteditable="true"></div><button></button>',
    );
    const [input, textarea, editable, button] = root.children;
    expect(isTypingTarget(input ?? null)).toBe(true);
    expect(isTypingTarget(textarea ?? null)).toBe(true);
    // jsdom は isContentEditable を実装していないので、属性から補う。
    if (editable instanceof HTMLElement && editable.isContentEditable === undefined) {
      Object.defineProperty(editable, 'isContentEditable', { value: true });
    }
    expect(isTypingTarget(editable ?? null)).toBe(true);
    expect(isTypingTarget(button ?? null)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});
