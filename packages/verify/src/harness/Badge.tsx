/**
 * verdict / check の小さな表示バッジ。ReplayPage が使う。
 * （Dashboard / UnitPage はインラインスタイルで独自表示するため、本ファイル非依存。）
 */

import type { CheckStatus, Verdict } from '../core/types';

const ICON: Record<CheckStatus, string> = {
  ok: '✅',
  fail: '❌',
  warn: '⚠️',
  probe: '🔍',
};

export function CheckIcon({ status }: { status: CheckStatus }) {
  return <span className={`check-icon check-${status}`}>{ICON[status]}</span>;
}

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  return (
    <span className={`verdict verdict-${verdict.toLowerCase()}`} data-verdict={verdict}>
      {verdict}
    </span>
  );
}
