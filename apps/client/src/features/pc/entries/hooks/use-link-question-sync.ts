'use client';

import { useCallback, useRef } from 'react';

interface UseLinkQuestionSyncParams {
  /** 現在ユーザーが「紐づけ済み」とみなしているローカル state. */
  linkedIds: ReadonlySet<string>;
  /** POST /entries/:id/questions/:qId. サーバー側 link は upsert で冪等. */
  link?: (entryId: string, questionId: string) => Promise<void>;
}

/**
 * Issue #319: 新規エントリで autosave が先に走ると、
 * `handleSaveWithTitle` の `isNew` 分岐が走らず、ローカルで紐づけられた
 * questionIds が DB に永続化されないバグの修正用ヘルパー。
 *
 * `flushPending(entryId)` を呼ぶと、現在の `linkedIds` を全て POST する。
 * link は ref 経由で参照するため、呼び出し時点で最新の Set が使われる。
 *
 * サーバー側の `LinkQuestionToEntryUsecase` は composite PK への upsert を行うため、
 * 既に紐づいている (entryId, questionId) を再 POST しても安全。
 */
export function useLinkQuestionSync({ linkedIds, link }: UseLinkQuestionSyncParams) {
  const linkedIdsRef = useRef(linkedIds);
  linkedIdsRef.current = linkedIds;

  const flushPending = useCallback(
    async (entryId: string) => {
      if (!link) return;
      for (const qId of linkedIdsRef.current) {
        await link(entryId, qId);
      }
    },
    [link],
  );

  return { flushPending };
}
