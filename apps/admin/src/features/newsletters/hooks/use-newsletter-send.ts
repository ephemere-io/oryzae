'use client';

import { useCallback, useState } from 'react';
import { z } from 'zod';
import { createApiClient } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { parseJson, readErrorMessage } from '@/lib/json';
import {
  type NewsletterPreview,
  newsletterPreviewSchema,
  type SendResult,
  sendResultSchema,
} from '../types';

const previewResponseSchema = z.object({ data: newsletterPreviewSchema });
const sendResponseSchema = z.object({ data: sendResultSchema });

/**
 * 送信の直前に見るもの（HTML プレビュー・宛先数）と、送信そのもの。
 *
 * 下書きの保存系（useNewsletterMutations）とは意図的に分けてある。取り消せない
 * 操作を、保存と同じ loading / error の枠で扱うと押し間違いが起きる。
 */
export function useNewsletterSend() {
  const [preview, setPreview] = useState<NewsletterPreview | null>(null);
  const [result, setResult] = useState<SendResult | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPreview = useCallback(async (id: string): Promise<boolean> => {
    const token = getAccessToken();
    if (!token) return false;

    setLoadingPreview(true);
    setError(null);
    setResult(null);
    setPreview(null);

    const api = createApiClient(token);
    const res = await api.fetch(`/api/v1/admin/newsletters/${id}/preview`);

    if (!res.ok) {
      setError(await readErrorMessage(res, 'プレビューの取得に失敗しました'));
      setLoadingPreview(false);
      return false;
    }

    const body = await parseJson(res, previewResponseSchema);
    if (!body) {
      setError('プレビューの取得に失敗しました（応答の形式が不正です）');
      setLoadingPreview(false);
      return false;
    }

    setPreview(body.data);
    setLoadingPreview(false);
    return true;
  }, []);

  const send = useCallback(async (id: string): Promise<SendResult | null> => {
    const token = getAccessToken();
    if (!token) return null;

    setSending(true);
    setError(null);

    const api = createApiClient(token);
    // confirm は API 側の契約。画面の 2 段階クリックだけに頼らない。
    const res = await api.fetch(`/api/v1/admin/newsletters/${id}/send`, {
      method: 'POST',
      body: JSON.stringify({ confirm: true }),
    });

    if (!res.ok) {
      setError(await readErrorMessage(res, '送信に失敗しました'));
      setSending(false);
      return null;
    }

    const body = await parseJson(res, sendResponseSchema);
    if (!body) {
      // 200 が返っている以上、送信自体は走っている可能性が高い。
      // 「失敗した」と言い切らず、確認を促す。
      setError('送信結果を読み取れませんでした。一覧を再読み込みして状態を確認してください。');
      setSending(false);
      return null;
    }

    setResult(body.data);
    setSending(false);
    return body.data;
  }, []);

  const reset = useCallback(() => {
    setPreview(null);
    setResult(null);
    setError(null);
  }, []);

  return { preview, result, loadPreview, send, loadingPreview, sending, error, reset };
}
