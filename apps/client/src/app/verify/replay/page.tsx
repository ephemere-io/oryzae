import { notFound } from 'next/navigation';
import { ReplayClient } from './replay-client';

type SearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function num(v: string | string[] | undefined): number | undefined {
  const s = first(v);
  if (s === undefined) return undefined;
  const n = Number.parseInt(s, 10);
  return Number.isNaN(n) ? undefined : n;
}

/**
 * Replay 画面（dev/preview 限定。本番では 404）。
 * クエリ（dwell/pre/key/chrome/auto/unit）を解釈して props で ReplayPage に渡す。
 */
export default async function VerifyReplayRoute({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  return (
    <ReplayClient
      dwell={num(sp.dwell)}
      preActMs={num(sp.pre)}
      keystrokeMs={num(sp.key)}
      chromeless={first(sp.chrome) === '0'}
      autoStart={first(sp.auto) !== '0'}
      unitId={first(sp.unit)}
    />
  );
}
