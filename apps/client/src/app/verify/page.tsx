import { notFound } from 'next/navigation';
import { VerifyDashboardClient } from './dashboard-client';

/** 検証ダッシュボード（dev/preview 限定。本番では 404）。 */
export default function VerifyPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <VerifyDashboardClient />;
}
