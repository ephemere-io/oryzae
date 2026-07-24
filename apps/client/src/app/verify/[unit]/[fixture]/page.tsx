import { notFound } from 'next/navigation';
import { UnitPageClient } from './unit-client';

/** 1ユニット×fixture の孤立マウント（dev/preview 限定。真の本番のみ 404）。 */
export default async function VerifyUnitRoute({
  params,
}: {
  params: Promise<{ unit: string; fixture: string }>;
}) {
  if (process.env.NODE_ENV === 'production' && process.env.VERCEL_ENV !== 'preview') notFound();
  const { unit, fixture } = await params;
  return <UnitPageClient unitId={unit} fixtureId={fixture} />;
}
