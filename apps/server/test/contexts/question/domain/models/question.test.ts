import { describe, expect, it } from 'vitest';
import { Question } from '@/contexts/question/domain/models/question';

const generateId = () => 'q-id';

describe('Question', () => {
  describe('create', () => {
    it('ユーザー作成の問いは isValidatedByUser=true になる', () => {
      const q = Question.create({ userId: 'u-1', isProposedByOryzae: false }, generateId);
      expect(q.isValidatedByUser).toBe(true);
      expect(q.isProposedByOryzae).toBe(false);
      expect(q.isArchived).toBe(false);
    });

    it('Oryzae 提案の問いは isValidatedByUser=false になる', () => {
      const q = Question.create({ userId: 'u-1', isProposedByOryzae: true }, generateId);
      expect(q.isValidatedByUser).toBe(false);
      expect(q.isProposedByOryzae).toBe(true);
    });

    it('新規作成時の jar 位置は null（フォールバック位置を使う）', () => {
      const q = Question.create({ userId: 'u-1', isProposedByOryzae: false }, generateId);
      expect(q.jarX).toBeNull();
      expect(q.jarY).toBeNull();
    });
  });

  describe('isActive', () => {
    it('非アーカイブ かつ 承認済みなら true', () => {
      const q = Question.fromProps({
        id: 'q-1',
        userId: 'u-1',
        isArchived: false,
        isValidatedByUser: true,
        isProposedByOryzae: false,
        jarX: null,
        jarY: null,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      });
      expect(q.isActive).toBe(true);
    });

    it('アーカイブ済みなら false', () => {
      const q = Question.fromProps({
        id: 'q-1',
        userId: 'u-1',
        isArchived: true,
        isValidatedByUser: true,
        isProposedByOryzae: false,
        jarX: null,
        jarY: null,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      });
      expect(q.isActive).toBe(false);
    });

    it('未承認なら false', () => {
      const q = Question.fromProps({
        id: 'q-1',
        userId: 'u-1',
        isArchived: false,
        isValidatedByUser: false,
        isProposedByOryzae: true,
        jarX: null,
        jarY: null,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      });
      expect(q.isActive).toBe(false);
    });
  });

  describe('withArchived / withUnarchived / withValidated', () => {
    const base = Question.fromProps({
      id: 'q-1',
      userId: 'u-1',
      isArchived: false,
      isValidatedByUser: false,
      isProposedByOryzae: true,
      jarX: null,
      jarY: null,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });

    it('withArchived はアーカイブ済みの新インスタンスを返す', () => {
      const archived = base.withArchived();
      expect(archived.isArchived).toBe(true);
      expect(base.isArchived).toBe(false); // 元は不変
    });

    it('withUnarchived は非アーカイブの新インスタンスを返す', () => {
      const archived = base.withArchived();
      const restored = archived.withUnarchived();
      expect(restored.isArchived).toBe(false);
    });

    it('withValidated は承認済みの新インスタンスを返す', () => {
      const validated = base.withValidated();
      expect(validated.isValidatedByUser).toBe(true);
      expect(base.isValidatedByUser).toBe(false); // 元は不変
    });
  });

  describe('withJarPosition', () => {
    const base = Question.fromProps({
      id: 'q-1',
      userId: 'u-1',
      isArchived: false,
      isValidatedByUser: true,
      isProposedByOryzae: false,
      jarX: null,
      jarY: null,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });

    it('jar 位置を反映した新インスタンスを返す（元は不変）', () => {
      const moved = base.withJarPosition(42.5, 17.25);
      expect(moved.jarX).toBe(42.5);
      expect(moved.jarY).toBe(17.25);
      expect(base.jarX).toBeNull();
      expect(base.jarY).toBeNull();
    });

    it('updatedAt を更新する', () => {
      const moved = base.withJarPosition(10, 10);
      expect(moved.updatedAt).not.toBe(base.updatedAt);
    });
  });

  describe('fromProps / toProps', () => {
    it('Props から復元し、同じ Props に変換できる', () => {
      const props = {
        id: 'q-1',
        userId: 'u-1',
        isArchived: true,
        isValidatedByUser: false,
        isProposedByOryzae: true,
        jarX: 33.3,
        jarY: 66.6,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-02T00:00:00Z',
      };
      expect(Question.fromProps(props).toProps()).toEqual(props);
    });
  });
});
