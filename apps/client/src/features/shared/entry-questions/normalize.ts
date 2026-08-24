import type { LinkedQuestion } from '@/features/shared/entry-questions/types';

/**
 * 問い紐付け API レスポンスの正規化。
 *
 * `const data: LinkedQuestion[] = await res.json()` は `as` と実質同じ型アサーションで、
 * 配列でないものが来ると state に流れ込み、`QuestionLinker` の `.map` で落ちる
 * （エディタ画面全体が落ちる）。
 *
 * 他の shared ドメインと同じ「**厳しい方に寄せる**」方針。
 */

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function normalizeLinkedQuestions(input: unknown): LinkedQuestion[] {
  if (!Array.isArray(input)) return [];

  const out: LinkedQuestion[] = [];
  for (const raw of input) {
    if (!isObject(raw) || typeof raw.id !== 'string') continue;
    out.push({
      id: raw.id,
      // 「まだ本文が無い問い」を null で表すので、null と string を区別して残す。
      currentText: typeof raw.currentText === 'string' ? raw.currentText : null,
    });
  }
  return out;
}
