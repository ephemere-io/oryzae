import type { QuestionItem } from '@/features/shared/questions/types';

/**
 * 問い API レスポンスの正規化。
 *
 * `res.json()` は型なし。`const data: QuestionItem[] = await res.json()` は `as` と実質同じ
 * 型アサーションで、配列でないもの（エラーエンベロープ等）が来ると state に流れ込み、
 * 描画側の `.filter` / `.map` で落ちる。
 *
 * `features/shared/{board,fermentation}/normalize.ts` と同じ「**厳しい方に寄せる**」方針:
 * 配列でなければ空、id を持たない要素は落とし、欠けたフィールドは既定値に潰す。
 */

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function normalizeQuestions(input: unknown): QuestionItem[] {
  if (!Array.isArray(input)) return [];

  const out: QuestionItem[] = [];
  for (const raw of input) {
    if (!isObject(raw) || typeof raw.id !== 'string') continue;
    out.push({
      id: raw.id,
      // currentText は「まだ本文が無い問い」を null で表すので、null と string を区別して残す。
      currentText: typeof raw.currentText === 'string' ? raw.currentText : null,
      isArchived: raw.isArchived === true,
      isProposedByOryzae: raw.isProposedByOryzae === true,
      isValidatedByUser: raw.isValidatedByUser === true,
      createdAt: str(raw.createdAt),
      updatedAt: str(raw.updatedAt),
    });
  }
  return out;
}
