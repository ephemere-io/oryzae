'use client';

// verify-exempt: 構図の定数を渡すだけの入口。中身は features/shared/auth が検証済み。

import { AuthEntrance } from '@/features/shared/auth/components/auth-entrance';
import { ENTRANCE_PC_LAYOUT } from '@/features/shared/auth/entrance/layout';

/**
 * PC の認証画面。扉を左に、紙（フォーム）を右に並べる。
 *
 * 端末と構図の対応づけはここが持つ。`features/shared/auth` は端末を知らない。
 */
export function PcAuthEntrance({ children }: { children: React.ReactNode }) {
  return <AuthEntrance layout={ENTRANCE_PC_LAYOUT}>{children}</AuthEntrance>;
}
