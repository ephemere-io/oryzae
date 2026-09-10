'use client';

import { ExternalLink } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Automation, CostKind } from '../inventory';

const REPO_URL = 'https://github.com/ephemere-io/oryzae/blob/main';

const COST_LABEL: Record<CostKind, { text: string; className: string }> = {
  tokens: { text: 'トークン課金', className: 'text-amber-400' },
  actions: { text: 'Actions 時間', className: 'text-muted-foreground' },
  none: { text: '無料', className: 'text-green-400' },
};

function CostBadge({ kind }: { kind: CostKind }) {
  const { text, className } = COST_LABEL[kind];
  return <span className={`text-xs ${className}`}>{text}</span>;
}

export function AutomationTable({ automations }: { automations: readonly Automation[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>名前</TableHead>
          <TableHead>いつ動くか</TableHead>
          <TableHead>1 回あたり</TableHead>
          <TableHead>止め方</TableHead>
          <TableHead className="w-6" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {automations.map((a) => (
          <TableRow key={a.id} className="align-top">
            <TableCell className="max-w-xs">
              <div className="text-sm">{a.name}</div>
              <div className="text-xs text-muted-foreground">{a.purpose}</div>
              {a.note && <div className="mt-1 text-xs text-muted-foreground/70">{a.note}</div>}
            </TableCell>
            <TableCell className="max-w-xs">
              {a.schedule && (
                <div className="text-xs tabular-nums text-foreground">定期: {a.schedule}</div>
              )}
              {a.triggers.map((t) => (
                <div key={t} className="text-xs text-muted-foreground">
                  {t}
                </div>
              ))}
              {!a.schedule && a.triggers.length === 0 && (
                <span className="text-xs text-muted-foreground">-</span>
              )}
            </TableCell>
            <TableCell className="max-w-[14rem]">
              <CostBadge kind={a.costKind} />
              <div className="text-xs text-muted-foreground">{a.costPerRun}</div>
            </TableCell>
            <TableCell className="max-w-xs text-xs text-muted-foreground">{a.killSwitch}</TableCell>
            <TableCell>
              <a
                href={`${REPO_URL}/${a.definedIn}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground"
                aria-label={`${a.name} の定義を開く`}
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
