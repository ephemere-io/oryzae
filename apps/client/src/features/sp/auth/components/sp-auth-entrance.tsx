'use client';

// verify-exempt: 構図の定数を渡すだけの入口。中身は features/shared/auth が検証済み。

import { AuthEntrance } from '@/features/shared/auth/components/auth-entrance';
import { SP_LAYOUT } from '@/features/shared/study/layout';

/**
 * SP の認証画面。扉を上の窓に残し、紙（フォーム）を下から敷く。
 *
 * 紙は画面に固定しない。キーボードが出たときに入力欄が隠れないよう、ふつうの
 * スクロールに乗せている（固定した紙の中だけをスクロールさせると iOS で入力欄が逃げる）。
 */
export function SpAuthEntrance({ children }: { children: React.ReactNode }) {
  return (
    <AuthEntrance layout={SP_LAYOUT} panel="sheet">
      {children}
    </AuthEntrance>
  );
}
