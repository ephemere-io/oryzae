'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { UserCostSummary } from '../hooks/use-user-cost-summary';

function formatCost(cost: number): string {
  return `$${cost.toFixed(4)}`;
}

export function UserCostTable({ items }: { items: UserCostSummary[] }) {
  const grandTotal = items.reduce((sum, item) => sum + item.totalCostUsd, 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Cost (All Users)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{formatCost(grandTotal)}</div>
        </CardContent>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead className="text-right">Fermentations</TableHead>
              <TableHead className="text-right">Total Cost</TableHead>
              <TableHead className="text-right">Avg / Request</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.userId}>
                <TableCell>{item.email || item.userId.slice(0, 8)}</TableCell>
                <TableCell className="text-right font-mono">{item.fermentationCount}</TableCell>
                <TableCell className="text-right font-mono font-medium">
                  {formatCost(item.totalCostUsd)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatCost(item.totalCostUsd / item.fermentationCount)}
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  コストデータがありません
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
