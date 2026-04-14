'use client';

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

interface UserCostTableProps {
  items: UserCostSummary[];
  onUserClick?: (userId: string) => void;
}

export function UserCostTable({ items, onUserClick }: UserCostTableProps) {
  return (
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
          <TableRow
            key={item.userId}
            className={onUserClick ? 'cursor-pointer hover:bg-muted/50' : undefined}
            onClick={onUserClick ? () => onUserClick(item.userId) : undefined}
          >
            <TableCell className="text-sm">{item.email || item.userId.slice(0, 8)}</TableCell>
            <TableCell className="text-right font-mono text-sm">{item.fermentationCount}</TableCell>
            <TableCell className="text-right font-mono text-sm">
              {formatCost(item.totalCostUsd)}
            </TableCell>
            <TableCell className="text-right font-mono text-xs text-muted-foreground">
              {formatCost(item.totalCostUsd / item.fermentationCount)}
            </TableCell>
          </TableRow>
        ))}
        {items.length === 0 && (
          <TableRow>
            <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
              No cost data
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
