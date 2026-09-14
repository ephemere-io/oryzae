'use client';

import { useCallback, useEffect, useState } from 'react';
import type { UnsubscribeState } from '../types';

/** トークンが URL に無い場合のメッセージ（リンクが途中で切れた等）。 */
const MISSING_TOKEN_MESSAGE = 'リンクが正しくありません。';

async function post(path: string, token: string): Promise<string | null> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  if (res.ok) return null;

  const body: unknown = await res.json().catch(() => null);
  if (
    typeof body === 'object' &&
    body !== null &&
    'error' in body &&
    typeof body.error === 'string'
  ) {
    return body.error;
  }
  return '処理できませんでした。時間をおいて試すか、設定画面から変更してください。';
}

/**
 * メールの配信停止リンクからの購読切り替え（ログイン不要）。
 *
 * ## なぜマウント時に自動で送るのか
 *
 * 「クリックするだけで登録解除」を満たすため、ページを開いた時点で停止まで
 * 済ませる。ボタンをもう一段挟むと、止めたい人に二度手間を強いることになる。
 *
 * ## なぜ GET ではなく POST なのか
 *
 * メールクライアントやセキュリティスキャナ（Outlook SafeLinks 等）はリンクを
 * **先読み**する。GET で状態が変わる作りだと、本人が押していないのに配信停止に
 * なる。先読みは JavaScript を実行しないので、ページを開いてから JS で POST
 * すれば誤作動しない。利用者から見れば「1 回クリックしただけ」のまま。
 */
export function useNewsletterUnsubscribe(token: string | null) {
  const [state, setState] = useState<UnsubscribeState>(
    token ? { status: 'working' } : { status: 'error', message: MISSING_TOKEN_MESSAGE },
  );

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    (async () => {
      const error = await post('/api/v1/newsletter/unsubscribe', token);
      if (cancelled) return;
      setState(error ? { status: 'error', message: error } : { status: 'unsubscribed' });
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  /** 「やっぱり受け取る」。押し間違い・誤作動からログインなしで戻せるようにする。 */
  const resubscribe = useCallback(async () => {
    if (!token) return;
    setState({ status: 'working' });
    const error = await post('/api/v1/newsletter/resubscribe', token);
    setState(error ? { status: 'error', message: error } : { status: 'resubscribed' });
  }, [token]);

  return { state, resubscribe };
}
