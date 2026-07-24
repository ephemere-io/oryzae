'use client';

import { DeviceView } from '@/components/device-view';
import { BoardView } from '@/features/pc/board/components/board-view';
import { useAuth } from '@/lib/auth-context';

export default function BoardPage() {
  const { api, loading: authLoading } = useAuth();

  if (authLoading || !api) return null;

  return <DeviceView pc={<BoardView api={api} />} />;
}
