'use client';

import { useEffect, useState } from 'react';
import { readBooleanField, readJson, readRequiredNumber } from '@/lib/json';

/**
 * Research Preview のサインアップ枠状況。サーバーの `SignupAvailability` と同形。
 * 内部 hook 専用なので export しない（knip で unused export 検出されないため）。
 */
interface SignupAvailability {
  limit: number;
  used: number;
  remaining: number;
  capacityReached: boolean;
}

/**
 * 必須の数値が揃っていなければ「取れなかった」として null を返す。
 *
 * ここを既定値 0 に倒すと、`{ error: '...' }` のような応答が
 * 「残り枠 0 だが満員ではない」という矛盾した表示になって本物として描画される。
 * 取れなかったことは呼び出し側でエラー表示に倒す。
 */
function normalizeSignupAvailability(input: unknown): SignupAvailability | null {
  const limit = readRequiredNumber(input, 'limit');
  const used = readRequiredNumber(input, 'used');
  const remaining = readRequiredNumber(input, 'remaining');
  if (limit === null || used === null || remaining === null) return null;
  return {
    limit,
    used,
    remaining,
    // 省略された場合でも remaining と矛盾しない値にする。
    capacityReached: readBooleanField(input, 'capacityReached', remaining <= 0),
  };
}

/**
 * `GET /api/v1/auth/signup/availability` をマウント時にフェッチして
 * 残り登録枠を取得する（Issue #300）。認証不要。
 *
 * - `loading`: 初回フェッチ中
 * - `error`: フェッチ失敗時のメッセージ（i18n はせず英語の生メッセージを返す）
 * - `availability`: 取得済みなら `SignupAvailability`、未取得なら null
 */
export function useSignupAvailability() {
  const [availability, setAvailability] = useState<SignupAvailability | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch('/api/v1/auth/signup/availability');
        if (!res.ok) {
          if (!cancelled) {
            setError(`Failed to load signup availability (${res.status})`);
            setLoading(false);
          }
          return;
        }
        const data = normalizeSignupAvailability(await readJson(res));
        if (!cancelled) {
          if (data) {
            setAvailability(data);
          } else {
            setError('Failed to load signup availability (unexpected response)');
          }
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load signup availability');
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { availability, loading, error };
}
