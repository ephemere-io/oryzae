import { describe, expect, it } from 'vitest';
import { QuestionTransaction } from '@/contexts/question/domain/models/question-transaction';
import { resolveCurrentText } from '@/contexts/question/domain/services/current-question-text.service';

describe('resolveCurrentText', () => {
  const makeTx = (version: number, validated: boolean) =>
    QuestionTransaction.fromProps({
      id: `tx-${version}`,
      questionId: 'q-1',
      string: `version ${version}`,
      questionVersion: version,
      isValidatedByUser: validated,
      isProposedByOryzae: !validated,
      createdAt: '2026-04-01T00:00:00Z',
      updatedAt: '2026-04-01T00:00:00Z',
    });

  it('空配列なら null を返す', () => {
    expect(resolveCurrentText([])).toBeNull();
  });

  it('validated な transaction のうち最大 version を返す', () => {
    const txs = [makeTx(1, true), makeTx(2, true), makeTx(3, false)];
    const result = resolveCurrentText(txs);
    expect(result?.questionVersion).toBe(2);
    expect(result?.string).toBe('version 2');
  });

  it('全て unvalidated なら null を返す', () => {
    const txs = [makeTx(1, false), makeTx(2, false)];
    expect(resolveCurrentText(txs)).toBeNull();
  });

  it('単一の validated transaction を正しく返す', () => {
    const txs = [makeTx(1, true)];
    const result = resolveCurrentText(txs);
    expect(result?.questionVersion).toBe(1);
  });
});
