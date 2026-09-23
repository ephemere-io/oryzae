'use client';

import { useCallback } from 'react';
import type { ApiClient } from '@/lib/api';
import { readBooleanField, readJson } from '@/lib/json';

/**
 * 初めての漬け込みに、その場で手紙を頼む（端末非依存）。
 *
 * 発酵は本来、夜間の cron が文字数と時間のゲートを見て発火する。初めての人はそこまで
 * 何も届かず「漬けたのに何も起きない」で終わるので、サーバは **発酵の行が 1 つも無い
 * ユーザーに限り** ゲートを飛ばして 1 通返す（`POST /api/v1/fermentations/first-letter`）。
 * 初回かどうかはサーバが判定するので、漬けるたびに呼んでよい（2 回目以降は fired=false）。
 *
 * LLM を同期で回すので返事まで数十秒かかる。呼ぶ側は待たずに画面を進め、`fired` が
 * 立ったら未読の手紙を取り直す。失敗しても投げない — 手紙は夜間の発酵でも届くので、
 * ここで落として漬け込みの体験を壊す価値が無い。
 */
export function useFirstLetter(api: ApiClient | null) {
  const requestFirstLetter = useCallback(async (): Promise<{ fired: boolean }> => {
    if (!api) return { fired: false };
    try {
      const res = await api.fetch('/api/v1/fermentations/first-letter', { method: 'POST' });
      if (!res.ok) return { fired: false };
      // 形が違えば「発火していない」に倒す（取り直しが 1 回減るだけで害は無い）。
      return { fired: readBooleanField(await readJson(res), 'fired', false) };
    } catch {
      return { fired: false };
    }
  }, [api]);

  return { requestFirstLetter };
}
