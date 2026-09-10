'use client';

import Link from 'next/link';
import { AutomationTable } from '@/features/automation/components/automation-table';
import {
  AUTOMATIONS,
  scheduledAutomations,
  tokenSpendingAutomations,
} from '@/features/automation/inventory';

const LEDGER_ISSUE_URL = 'https://github.com/ephemere-io/oryzae/issues/578';

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export default function AutomationPage() {
  const scheduled = scheduledAutomations();
  const tokenSpending = tokenSpendingAutomations();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/observability" className="text-sm text-muted-foreground hover:text-foreground">
          Observability
        </Link>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-xl font-medium">自動実行</h1>
        <span className="text-sm text-muted-foreground">{AUTOMATIONS.length} 件</span>
      </div>

      <p className="text-sm text-muted-foreground">
        人が起動しなくても動くものの一覧。増やすのは簡単で把握は難しいので、ここに集めている。
        一覧に載っていない自動起動があると CI が落ちる（<code>pnpm check:automation</code>）ので、
        この表は実態とずれない。
      </p>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="自動で回るもの" value={`${AUTOMATIONS.length} 件`} />
        <Stat label="定期実行" value={`${scheduled.length} 件`} hint="放っておいても動く" />
        <Stat label="トークン課金あり" value={`${tokenSpending.length} 件`} hint="月額上限の対象" />
      </div>

      <AutomationTable automations={AUTOMATIONS} />

      <p className="text-xs text-muted-foreground">
        トークンの使用額と実行履歴は{' '}
        <a
          href={LEDGER_ISSUE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-foreground"
        >
          台帳 Issue
        </a>
        で見られる。仕組みの説明は <code>docs/auto-fix-loop-guide.md</code>。
      </p>
    </div>
  );
}
