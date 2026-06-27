'use client';

import { VerifyUnitPage } from '@oryzae/verify';
import '@/lib/verify/register';

export function UnitPageClient({ unitId, fixtureId }: { unitId: string; fixtureId: string }) {
  return <VerifyUnitPage unitId={unitId} fixtureId={fixtureId} />;
}
