import type { QuestionTransaction } from '../models/question-transaction';

/**
 * validated な transaction のうち question_version 最大のものを返す。
 * 有効な transaction がなければ null。
 */
export function resolveCurrentText(
  transactions: QuestionTransaction[],
): QuestionTransaction | null {
  let latest: QuestionTransaction | null = null;
  for (const tx of transactions) {
    if (!tx.isValidatedByUser) continue;
    if (!latest || tx.questionVersion > latest.questionVersion) {
      latest = tx;
    }
  }
  return latest;
}
