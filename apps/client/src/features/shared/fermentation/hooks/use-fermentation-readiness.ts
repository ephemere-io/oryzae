'use client';

import { useCallback, useEffect, useState } from 'react';
import type { JarReadiness } from '@/features/shared/fermentation/types';
import type { ApiClient } from '@/lib/api';
import { readJson, readNumberField } from '@/lib/json';

/**
 * 発酵瓶の readiness を取得する（issue #278）。端末非依存。
 *
 * 返るのは「持っている問いの readiness の総和」と「問いの数」だけ。次回発火時刻や
 * 残り文字数はサーバーが返さない（「いつ来るか分からない」ことが体験の芯なので、
 * 逆算の材料を client に置かない）。
 *
 * サーバーは cron が日次で書く値ではなくリクエスト時に評価し直すので、マウントのたびに
 * 最新になる。漬け込み直後は `/jar` へ遷移してこのページがマウントされるため、
 * 追加の再取得を仕込まなくてもエントリ追加が瓶に反映される。
 */
export function useFermentationReadiness(api: ApiClient | null, authLoading: boolean) {
  const [data, setData] = useState<JarReadiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    // 認証確定前は loading のまま待つ。確定して api が無い（未ログイン）なら取得は諦める。
    if (authLoading) return;
    if (!api) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.fetch('/api/v1/fermentations/readiness');
      if (!res.ok) {
        setError('readiness の取得に失敗しました');
        return;
      }
      const body = await readJson(res);
      // 形が違えば既定値へ倒す（normalize.ts と同じ「厳しい方に寄せる」方針）。
      // readiness が取れなくても瓶は「空の瓶」として成立するので、0 が安全な既定値。
      setData({
        score: readNumberField(body, 'score', 0),
        questionCount: readNumberField(body, 'questionCount', 0),
      });
    } catch {
      // 取れなくても瓶は描ける。catch が無いと effect 内の未処理 rejection になり、
      // loading も true に張り付く（use-fermentation-inbox と同じ判断）。
      setError('readiness の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [api, authLoading]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
