'use client';

import { useCallback, useState } from 'react';
import { z } from 'zod';
import { createApiClient } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { parseJson, readErrorMessage } from '@/lib/json';
import {
  type GenerateDraftResult,
  generateDraftResultSchema,
  type Newsletter,
  newsletterSchema,
} from '../types';

const itemResponseSchema = z.object({ data: newsletterSchema });

interface DraftContent {
  subject: string;
  bodyMarkdown: string;
}

/**
 * 下書きの作成・更新・削除と、PR 差分からの下書き生成。
 *
 * 1 つのフックにまとめてあるのは、どれもエディタ画面の同じ操作列（保存 / 破棄 /
 * 自動生成）で、loading と error を 1 組で表示するため。**送信だけは別フック**
 * にしてある（間違って同じボタン状態で扱われると事故になる操作なので）。
 */
export function useNewsletterMutations() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = useCallback(
    async <T>(
      path: string,
      init: RequestInit,
      schema: z.ZodType<T>,
      fallbackMessage: string,
    ): Promise<T | null> => {
      const token = getAccessToken();
      if (!token) return null;

      setSaving(true);
      setError(null);

      const api = createApiClient(token);
      const res = await api.fetch(path, init);

      if (!res.ok) {
        setError(await readErrorMessage(res, fallbackMessage));
        setSaving(false);
        return null;
      }

      const body = await parseJson(res, schema);
      if (!body) setError(`${fallbackMessage}（応答の形式が不正です）`);
      setSaving(false);
      return body;
    },
    [],
  );

  const create = useCallback(
    async (content: DraftContent): Promise<Newsletter | null> => {
      const body = await request(
        '/api/v1/admin/newsletters',
        { method: 'POST', body: JSON.stringify(content) },
        itemResponseSchema,
        '下書きの作成に失敗しました',
      );
      return body?.data ?? null;
    },
    [request],
  );

  const update = useCallback(
    async (id: string, content: DraftContent): Promise<Newsletter | null> => {
      const body = await request(
        `/api/v1/admin/newsletters/${id}`,
        { method: 'PUT', body: JSON.stringify(content) },
        itemResponseSchema,
        '下書きの保存に失敗しました',
      );
      return body?.data ?? null;
    },
    [request],
  );

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      const body = await request(
        `/api/v1/admin/newsletters/${id}`,
        { method: 'DELETE' },
        z.object({ data: z.object({ id: z.string() }) }),
        '下書きの削除に失敗しました',
      );
      return body !== null;
    },
    [request],
  );

  const generateDraft = useCallback(async (): Promise<GenerateDraftResult | null> => {
    return await request(
      '/api/v1/admin/newsletters/generate-draft',
      { method: 'POST', body: JSON.stringify({}) },
      generateDraftResultSchema,
      '下書きの生成に失敗しました',
    );
  }, [request]);

  const resetError = useCallback(() => setError(null), []);

  return { create, update, remove, generateDraft, saving, error, resetError };
}
