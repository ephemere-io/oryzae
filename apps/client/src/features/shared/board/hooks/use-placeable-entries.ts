'use client';

import { useCallback, useEffect, useState } from 'react';
import { normalizePlaceableEntries } from '@/features/shared/board/normalize';
import type { PlaceableEntry } from '@/features/shared/board/types';
import type { ApiClient } from '@/lib/api';

interface UsePlaceableEntriesResult {
  entries: PlaceableEntry[];
  loading: boolean;
  error: boolean;
  refresh: () => Promise<void>;
}

/**
 * その日（その週）に書いた日記のうち、盤面に置ける候補を取る。
 *
 * 以前はサーバが期間内の日記を勝手にカード化していた。置いた覚えのないカードが
 * 現れる一方で外し方も見えなかったので、「候補を見せて選ばせる」に変えた。
 * enabled が false のあいだは取りに行かない（ダイアログを開いたときだけ引く）。
 */
export function usePlaceableEntries(
  api: ApiClient | null,
  dateKey: string,
  viewType: 'daily' | 'weekly',
  enabled: boolean,
): UsePlaceableEntriesResult {
  const [entries, setEntries] = useState<PlaceableEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const fetchEntries = useCallback(async () => {
    if (!api) return;
    setLoading(true);
    setError(false);
    try {
      const tzOffset = new Date().getTimezoneOffset();
      const res = await api.fetch(
        `/api/v1/board/entries?dateKey=${dateKey}&viewType=${viewType}&tzOffset=${tzOffset}`,
      );
      if (!res.ok) throw new Error(`Failed to load placeable entries (${res.status})`);
      // res.json() は型なし。型注釈を付けるのは `as` と実質同じアサーションになり、
      // 要素が壊れた応答をそのまま state に流してしまう（描画側で落ちる）。
      const data: unknown = await res.json();
      setEntries(
        normalizePlaceableEntries(
          typeof data === 'object' && data !== null && 'entries' in data ? data.entries : null,
        ),
      );
    } catch {
      // 取得できなかったことを画面に出せるよう、握り潰さず状態にする。
      setError(true);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [api, dateKey, viewType]);

  useEffect(() => {
    if (!enabled) return;
    void fetchEntries();
  }, [enabled, fetchEntries]);

  return { entries, loading, error, refresh: fetchEntries };
}
