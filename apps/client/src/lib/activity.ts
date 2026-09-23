/**
 * 「何かを成し遂げた」を、画面をまたいで伝える合図。
 *
 * 問いを立てた・問いを結んだ・漬け込んだ、の 3 つ。ヘルプの三歩（`features/shared/help`）が
 * これを聞いて進み具合を取り直す。データを持つ側（questions / entries の hook）と、
 * それを映す側（help）は別のドメインなので、import ではなく window のイベントでつなぐ。
 * 中身は種類だけ — 文も id も載せない。
 */

export const ACTIVITY_EVENT = 'oryzae:activity';

export type ActivityKind = 'question' | 'link' | 'pickle';

const KINDS: readonly ActivityKind[] = ['question', 'link', 'pickle'];

export function notifyActivity(kind: ActivityKind): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<ActivityKind>(ACTIVITY_EVENT, { detail: kind }));
}

/** 聞く側の門。自前のイベント以外（detail が無い・知らない種類）は null。 */
export function readActivityKind(event: Event): ActivityKind | null {
  if (!(event instanceof CustomEvent)) return null;
  const detail: unknown = event.detail;
  return KINDS.find((kind) => kind === detail) ?? null;
}
