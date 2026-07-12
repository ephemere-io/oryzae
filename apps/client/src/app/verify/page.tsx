import { notFound } from 'next/navigation';
import { VerifyDashboardClient } from './dashboard-client';

/**
 * 検証ダッシュボード（dev/preview 限定。真の本番のみ 404）。
 * Vercel は preview も production も NODE_ENV=production のため、preview を通すには
 * VERCEL_ENV で切り分ける（=preview は有効、=production は 404）。
 */
export default function VerifyPage() {
  if (process.env.NODE_ENV === 'production' && process.env.VERCEL_ENV !== 'preview') notFound();
  return <VerifyDashboardClient />;
}
