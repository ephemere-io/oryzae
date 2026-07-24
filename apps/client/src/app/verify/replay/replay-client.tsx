'use client';

import { type ReplayPageProps, VerifyReplayPage } from '@oryzae/verify';
// クライアントバンドルでユニット/verifier を登録する（registry はクライアント側で読まれる）。
import '@/app/verify/register';

export function ReplayClient(props: ReplayPageProps) {
  return <VerifyReplayPage {...props} />;
}
