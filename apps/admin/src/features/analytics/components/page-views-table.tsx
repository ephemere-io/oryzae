'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { PageViewItem } from '../hooks/use-analytics';

export function PageViewsTable({ items }: { items: PageViewItem[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Path</TableHead>
          <TableHead className="text-right">Views</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.path}>
            <TableCell className="font-mono text-xs">{item.path}</TableCell>
            <TableCell className="text-right font-mono text-sm">
              {item.views.toLocaleString()}
            </TableCell>
          </TableRow>
        ))}
        {items.length === 0 && (
          <TableRow>
            <TableCell colSpan={2} className="text-center text-muted-foreground py-8">
              No pageview data
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
