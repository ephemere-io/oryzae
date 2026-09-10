'use client';

import { useCallback } from 'react';
import type { ApiClient } from '@/lib/api';

interface CreateSnippetPayload {
  text: string;
  /**
   * 配置位置（world 座標）。ボードから作るときに「いま見えている場所」を渡す。
   * 省略するとサーバーが従来どおりランダムに散らす（エディタからの作成はこちら）。
   */
  x?: number;
  y?: number;
}

/**
 * 抜粋（snippet）をボードに1件作る（端末非依存）。
 *
 * Issue #490: ボード（useBoard.createSnippet）とエディタの選択ツールバー
 * （snippet-toolbar）が同じ POST を別実装で叩いていたため、ここへ集約した。
 * 呼び出し側の後処理（ボードは再取得、ツールバーは保存表示）が違うだけなので、
 * 送信のみを共有し、成否を boolean で返す。
 */
export function useCreateSnippet(api: ApiClient | null) {
  return useCallback(
    async (payload: CreateSnippetPayload): Promise<boolean> => {
      if (!api) return false;
      const res = await api.fetch('/api/v1/board/snippets', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return res.ok;
    },
    [api],
  );
}
