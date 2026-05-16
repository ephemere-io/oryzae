'use client';

import { useCallback, useState } from 'react';
import { createApiClient } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

// Issue #326: 管理画面からテストアカウントを一括削除する。
// 関連テーブル (entries, questions, fermentation_results, boards, profiles, ...)
// と storage オブジェクト (avatars/, board-photos/) をまとめて消してから
// auth.users から削除する。Supabase Dashboard の Auth → Users 削除が
// "Database error deleting user" で失敗するケースのワークアラウンド。

export function useDeleteUser() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteUser = useCallback(async (userId: string): Promise<boolean> => {
    const token = getAccessToken();
    if (!token) return false;

    setLoading(true);
    setError(null);

    const api = createApiClient(token);
    const res = await api.fetch(`/api/v1/admin/users/${userId}`, { method: 'DELETE' });

    if (res.ok) {
      setLoading(false);
      return true;
    }

    let message = 'ユーザーの削除に失敗しました';
    try {
      const body = (await res.json()) as { error?: string };
      if (typeof body.error === 'string' && body.error.length > 0) message = body.error;
    } catch {
      // body が JSON でない場合はデフォルト文言のまま
    }
    setError(message);
    setLoading(false);
    return false;
  }, []);

  const reset = useCallback(() => {
    setError(null);
  }, []);

  return { deleteUser, loading, error, reset };
}
