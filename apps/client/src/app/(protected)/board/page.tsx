'use client';

import { useAuth } from '@/features/auth/hooks/use-auth';
import { BoardView } from '@/features/board/components/board-view';

export default function BoardPage() {
  const { api, loading: authLoading } = useAuth();

  if (authLoading || !api) return null;

  return <BoardView api={api} />;
}
