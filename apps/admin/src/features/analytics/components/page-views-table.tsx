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
  const maxViews = Math.max(...items.map((i) => i.views), 1);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Path</TableHead>
          <TableHead className="text-right">Views</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => {
          const pct = (item.views / maxViews) * 100;
          return (
            <TableRow key={item.path}>
              <TableCell className="font-mono text-xs">{item.path}</TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary/60 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="font-mono text-sm min-w-[3rem] text-right">
                    {item.views.toLocaleString()}
                  </span>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
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
