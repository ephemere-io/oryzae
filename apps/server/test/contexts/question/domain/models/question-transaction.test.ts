import { describe, expect, it } from 'vitest';
import { QuestionTransaction } from '@/contexts/question/domain/models/question-transaction';

const generateId = () => 'qt-id';

describe('QuestionTransaction', () => {
  describe('create', () => {
    it('有効なパラメータで作成できる', () => {
      const result = QuestionTransaction.create(
        {
          questionId: 'q-1',
          string: 'What is love?',
          questionVersion: 1,
          isProposedByOryzae: false,
        },
        generateId,
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.id).toBe('qt-id');
        expect(result.value.string).toBe('What is love?');
        expect(result.value.questionVersion).toBe(1);
        expect(result.value.isValidatedByUser).toBe(true);
      }
    });

    it('Oryzae 提案は isValidatedByUser=false になる', () => {
      const result = QuestionTransaction.create(
        {
          questionId: 'q-1',
          string: 'AI suggested',
          questionVersion: 2,
          isProposedByOryzae: true,
        },
        generateId,
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.isValidatedByUser).toBe(false);
        expect(result.value.isProposedByOryzae).toBe(true);
      }
    });

    it('空文字で EMPTY_STRING エラーを返す', () => {
      const result = QuestionTransaction.create(
        { questionId: 'q-1', string: '', questionVersion: 1, isProposedByOryzae: false },
        generateId,
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('EMPTY_STRING');
      }
    });

    it('空白のみで EMPTY_STRING エラーを返す', () => {
      const result = QuestionTransaction.create(
        { questionId: 'q-1', string: '   ', questionVersion: 1, isProposedByOryzae: false },
        generateId,
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('EMPTY_STRING');
      }
    });

    it('64文字超で STRING_TOO_LONG エラーを返す', () => {
      const result = QuestionTransaction.create(
        {
          questionId: 'q-1',
          string: 'a'.repeat(65),
          questionVersion: 1,
          isProposedByOryzae: false,
        },
        generateId,
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('STRING_TOO_LONG');
      }
    });

    it('64文字ちょうどは成功する', () => {
      const result = QuestionTransaction.create(
        {
          questionId: 'q-1',
          string: 'a'.repeat(64),
          questionVersion: 1,
          isProposedByOryzae: false,
        },
        generateId,
      );
      expect(result.success).toBe(true);
    });
  });

  describe('withValidated', () => {
    it('承認済みの新インスタンスを返す', () => {
      const tx = QuestionTransaction.fromProps({
        id: 'qt-1',
        questionId: 'q-1',
        string: 'test',
        questionVersion: 1,
        isValidatedByUser: false,
        isProposedByOryzae: true,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      });
      const validated = tx.withValidated();
      expect(validated.isValidatedByUser).toBe(true);
      expect(tx.isValidatedByUser).toBe(false); // 元は不変
    });
  });

  describe('fromProps / toProps', () => {
    it('Props から復元し、同じ Props に変換できる', () => {
      const props = {
        id: 'qt-1',
        questionId: 'q-1',
        string: 'test question',
        questionVersion: 3,
        isValidatedByUser: true,
        isProposedByOryzae: false,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-02T00:00:00Z',
      };
      expect(QuestionTransaction.fromProps(props).toProps()).toEqual(props);
    });
  });
});
