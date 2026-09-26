'use client';

import { SpendView } from '@/features/tools/components/spend-view';
import { useSpend } from '@/features/tools/hooks/use-spend';

export default function SpendPage() {
  const { data, loading, error, refresh } = useSpend(30);
  return <SpendView data={data} loading={loading} error={error} onRefresh={refresh} />;
}
