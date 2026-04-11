'use client';

import { useAuth } from '@/features/auth/hooks/use-auth';
import { BoardView } from '@/features/board/components/board-view';

export default function BoardPage() {
  const { api, loading: authLoading } = useAuth();

  if (authLoading || !api) {
    return (
      <div
        className="flex h-full items-center justify-center text-xs"
        style={{ color: 'var(--date-color)' }}
      >
        Loading...
      </div>
    );
  }

  return <BoardView api={api} />;
}
