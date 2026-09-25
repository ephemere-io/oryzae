import { notFound } from 'next/navigation';
import { EnterTrace } from './enter-trace';

/**
 * 入室（ログイン → 扉 → 書斎）の実測（dev/preview 限定。真の本番のみ 404）。
 *
 * 実機でしか出ない「ブツ切れ」を、こちらが数字で受け取るための画面。`/verify` と同じ扱い。
 */
export default function VerifyEnterPage() {
  if (process.env.NODE_ENV === 'production' && process.env.VERCEL_ENV !== 'preview') notFound();
  return <EnterTrace />;
}
