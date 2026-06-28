import { notFound } from 'next/navigation';
import { UnitPageClient } from './unit-client';

/** 1ユニット×fixture の孤立マウント（dev/preview 限定。本番では 404）。 */
export default async function VerifyUnitRoute({
  params,
}: {
  params: Promise<{ unit: string; fixture: string }>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { unit, fixture } = await params;
  return <UnitPageClient unitId={unit} fixtureId={fixture} />;
}
