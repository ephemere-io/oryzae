'use client';

import { DeviceView } from '@/components/device-view';
import { BoardView } from '@/features/pc/board/components/board-view';
import { useAuth } from '@/lib/auth-context';
import { BoardRouteLoading } from '../_loading/board-route-loading';

export default function BoardPage() {
  const { api, loading: authLoading } = useAuth();

  // 認証解決までは **ロード表示を出し続ける**。null を返すと
  // 「ロード表示 → 真っ白 → 本体」になり、直前まで出ていた枠が一度消える
  // （ハードリロード時に必ず通る。クライアント遷移では認証解決済みなので素通り）。
  if (authLoading || !api) return <BoardRouteLoading />;

  return <DeviceView pc={<BoardView api={api} />} />;
}
