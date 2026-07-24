'use client';

import { VerifyDashboard } from '@oryzae/verify';
// クライアントバンドルでユニット/verifier を登録する（registry はクライアント側で読まれる）。
import './register';

export function VerifyDashboardClient() {
  return <VerifyDashboard />;
}
