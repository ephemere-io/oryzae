/**
 * 「いま触れているもの」を DOM から読む（`docs/help-mode-guide.md`「触れると説明が出る」）。
 *
 * 画面の部品は `data-help="<話題>"` を名乗れる。名乗っていない部品は、その名前
 * （aria-label・title・文字）を手掛かりに話題へ当てる（`use-help-resolver`）。
 * ここは DOM を読むだけの純関数で、状態を持たない。
 */

import { isHelpTopicId } from './topics';
import type { HelpTopicId } from './types';

/** 部品が名乗る話題。 */
const HELP_ATTR = 'data-help';
/** ヘルプの面そのもの。この中で動いても「触れているもの」は変えない。 */
export const HELP_PANEL_ATTR = 'data-help-panel';

/** 名前として拾う文字の上限。長い本文を名前にしない。 */
const LABEL_MAX = 80;

const INTERACTIVE =
  'button, a, input, textarea, select, [role="button"], [role="tab"], [role="menuitem"], [role="option"]';

export interface HoverTarget {
  /** 名乗っている話題（自分か先祖の `data-help`）。 */
  topic: HelpTopicId | null;
  /** 触れている押せるものの名前。話題を名乗っていない部品を当てる手掛かり。 */
  label: string | null;
}

/**
 * 触れている要素から、話題と名前を読む。
 *
 * - ヘルプの面の中なら `'inside-panel'`（呼び出し側は何もしない）
 * - 話題も押せるものも無ければ null（「何にも触れていない」）
 */
export function hoverTargetOf(element: Element | null): HoverTarget | 'inside-panel' | null {
  if (!element) return null;
  if (element.closest(`[${HELP_PANEL_ATTR}]`)) return 'inside-panel';

  const named = element.closest(`[${HELP_ATTR}]`);
  const attr = named?.getAttribute(HELP_ATTR) ?? null;
  const topic = isHelpTopicId(attr) ? attr : null;

  const interactive = element.closest(INTERACTIVE);
  // 押せるもの自身が話題を名乗っているなら、名前で当て直す必要は無い。
  const label = interactive && interactive !== named ? labelOf(interactive) : null;

  if (topic === null && label === null) return null;
  return { topic, label };
}

/** 押せるものの名前。読み上げに使う名前と同じ順で拾う。 */
export function labelOf(element: Element): string | null {
  const explicit = element.getAttribute('aria-label') ?? element.getAttribute('title');
  const raw = explicit ?? element.textContent ?? '';
  const text = raw.replace(/\s+/g, ' ').trim();
  if (text.length === 0) return null;
  return text.length > LABEL_MAX ? text.slice(0, LABEL_MAX) : text;
}

/** 文字を打っている最中か。`?` のショートカットを、入力欄の `?` と取り違えない。 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}
