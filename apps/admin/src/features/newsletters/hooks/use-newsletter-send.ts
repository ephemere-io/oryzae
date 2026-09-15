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
  type TestSendResult,
  type TranslateResult,
  testSendResultSchema,
  translateResultSchema,
} from '../types';

const previewResponseSchema = z.object({ data: newsletterPreviewSchema });
const sendResponseSchema = z.object({ data: sendResultSchema });
const testSendResponseSchema = z.object({ data: testSendResultSchema });
const translateResponseSchema = z.object({ data: translateResultSchema });

/**
 * 送信の直前に見るもの（HTML プレビュー・宛先数）と、送信そのもの。
 *
 * 下書きの保存系（useNewsletterMutations）とは意図的に分けてある。取り消せない
 * 操作を、保存と同じ loading / error の枠で扱うと押し間違いが起きる。
 */
export function useNewsletterSend() {
  const [preview, setPreview] = useState<NewsletterPreview | null>(null);
  const [result, setResult] = useState<SendResult | null>(null);
  const [testResult, setTestResult] = useState<TestSendResult | null>(null);
  const [translateResult, setTranslateResult] = useState<TranslateResult | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [translating, setTranslating] = useState(false);
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

  /**
   * 宛先がいる言語へ翻訳する。
   *
   * 原文が変わっていない言語は訳し直さない（サーバー側で判定）。押すたびに
   * 全言語へ課金される作りにはしていない。
   */
  const translate = useCallback(async (id: string): Promise<TranslateResult | null> => {
    const token = getAccessToken();
    if (!token) return null;

    setTranslating(true);
    setError(null);

    const api = createApiClient(token);
    const res = await api.fetch(`/api/v1/admin/newsletters/${id}/translate`, {
      method: 'POST',
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      setError(await readErrorMessage(res, '翻訳に失敗しました'));
      setTranslating(false);
      return null;
    }

    const body = await parseJson(res, translateResponseSchema);
    if (!body) {
      setError('翻訳の結果を読み取れませんでした。プレビューを開き直して確認してください。');
      setTranslating(false);
      return null;
    }

    setTranslateResult(body.data);
    setTranslating(false);
    return body.data;
  }, []);

  /**
   * 運営者だけへのテスト配信。
   *
   * 本番送信 (`send`) と **state を分けてある** —— 同じ sending / result を
   * 共有すると、テストの結果を見ながら本番のボタンを押す流れで取り違える。
   */
  const sendTest = useCallback(async (id: string): Promise<TestSendResult | null> => {
    const token = getAccessToken();
    if (!token) return null;

    setTestSending(true);
    setError(null);
    setTestResult(null);

    const api = createApiClient(token);
    const res = await api.fetch(`/api/v1/admin/newsletters/${id}/send-test`, {
      method: 'POST',
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      setError(await readErrorMessage(res, 'テスト配信に失敗しました'));
      setTestSending(false);
      return null;
    }

    const body = await parseJson(res, testSendResponseSchema);
    if (!body) {
      setError('テスト配信の結果を読み取れませんでした。受信箱を確認してください。');
      setTestSending(false);
      return null;
    }

    setTestResult(body.data);
    setTestSending(false);
    return body.data;
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
    setTestResult(null);
    setTranslateResult(null);
    setError(null);
  }, []);

  return {
    preview,
    result,
    testResult,
    translateResult,
    loadPreview,
    send,
    sendTest,
    translate,
    loadingPreview,
    sending,
    testSending,
    translating,
    error,
    reset,
  };
}
