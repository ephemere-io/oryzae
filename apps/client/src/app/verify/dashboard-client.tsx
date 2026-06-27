'use client';

import { VerifyDashboard } from '@oryzae/verify';
// クライアントバンドルでユニット/verifier を登録する（registry はクライアント側で読まれる）。
import '@/lib/verify/register';

export function VerifyDashboardClient() {
  return <VerifyDashboard />;
}
