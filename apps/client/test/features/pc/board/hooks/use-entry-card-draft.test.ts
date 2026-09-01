import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useEntryCardDraft } from '@/features/pc/board/hooks/use-entry-card-draft';
import type { BoardCardData } from '@/features/shared/board/types';

function base(id: string): Omit<BoardCardData, 'cardType' | 'content'> {
  return {
    id,
    refId: `ref-${id}`,
    x: 0,
    y: 0,
    rotation: 0,
    width: 340,
    height: 280,
    zIndex: 0,
    userPositioned: false,
    createdAt: '2026-04-11T10:00:00Z',
  };
}

function entryCard(id: string, title: string, body: string): BoardCardData {
  return {
    ...base(id),
    cardType: 'entry',
    content: { title, body, createdAt: '2026-04-11T10:00:00Z' },
  };
}

describe('useEntryCardDraft', () => {
  it('編集に入ると、そのカードの中身が下書きに入る', () => {
    // ここが本題。以前は編集フラグだけ立てる経路が残っていて、見えている本文は
    // そのままなのに編集欄が空、という食い違いが起きていた。
    const { result } = renderHook(() => useEntryCardDraft());

    act(() => result.current.start(entryCard('c-1', '見出し', '本文です')));

    expect(result.current.editingCardId).toBe('c-1');
    expect(result.current.draft).toEqual({ title: '見出し', body: '本文です' });
  });

  it('下書きを積まずに編集へ入る道が無い（editingCardId は start でしか立たない）', () => {
    const { result } = renderHook(() => useEntryCardDraft());

    expect(result.current.editingCardId).toBeNull();
    expect(Object.keys(result.current)).not.toContain('setEditingCardId');
  });

  it('別のカードに移ると下書きも入れ替わる', () => {
    const { result } = renderHook(() => useEntryCardDraft());

    act(() => result.current.start(entryCard('c-1', 'A', 'あ')));
    act(() => result.current.setBody('直した'));
    act(() => result.current.start(entryCard('c-2', 'B', 'い')));

    expect(result.current.editingCardId).toBe('c-2');
    // 前のカードの編集内容を持ち越さない
    expect(result.current.draft).toEqual({ title: 'B', body: 'い' });
  });

  it('見出しと本文を別々に直せる', () => {
    const { result } = renderHook(() => useEntryCardDraft());

    act(() => result.current.start(entryCard('c-1', '見出し', '本文')));
    act(() => result.current.setTitle('新しい見出し'));
    act(() => result.current.setBody('新しい本文'));

    expect(result.current.draft).toEqual({ title: '新しい見出し', body: '新しい本文' });
  });

  it('本文が空のエントリでも編集に入れる（1行だけの日記）', () => {
    const { result } = renderHook(() => useEntryCardDraft());

    act(() => result.current.start(entryCard('c-1', '一行だけ', '')));

    expect(result.current.editingCardId).toBe('c-1');
    expect(result.current.draft).toEqual({ title: '一行だけ', body: '' });
  });

  it('スニペットや写真では編集に入らない', () => {
    const { result } = renderHook(() => useEntryCardDraft());
    const snippet: BoardCardData = {
      ...base('c-s'),
      cardType: 'snippet',
      content: { text: 'メモ' },
    };
    const photo: BoardCardData = {
      ...base('c-p'),
      cardType: 'photo',
      content: { imageUrl: 'https://example.com/a.jpg', caption: '' },
    };

    act(() => result.current.start(snippet));
    expect(result.current.editingCardId).toBeNull();

    act(() => result.current.start(photo));
    expect(result.current.editingCardId).toBeNull();
  });

  it('stop で編集を抜ける', () => {
    const { result } = renderHook(() => useEntryCardDraft());

    act(() => result.current.start(entryCard('c-1', '見出し', '本文')));
    act(() => result.current.stop());

    expect(result.current.editingCardId).toBeNull();
  });
});
