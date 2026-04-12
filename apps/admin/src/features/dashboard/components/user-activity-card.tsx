'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface UserActivityCardProps {
  activeWriters: number;
  totalUsers: number;
}

export function UserActivityCard({ activeWriters, totalUsers }: UserActivityCardProps) {
  const ratio = totalUsers > 0 ? (activeWriters / totalUsers) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          ユーザー動向（7日間）
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${ratio}%` }}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{activeWriters}</span> / {totalUsers}{' '}
          ユーザーが書いた
        </p>
      </CardContent>
    </Card>
  );
}
