'use client';

import { Clock, Eye, FileText, FlaskConical, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AnalyticsOverview } from '../hooks/use-analytics';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
}

function StatCard({ title, value, subtitle, icon }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </div>
        {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}m ${secs}s`;
}

export function AnalyticsOverviewCards({ overview }: { overview: AnalyticsOverview }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <StatCard
        title="Total Pageviews"
        value={overview.totalPageviews}
        subtitle="過去7日間"
        icon={<Eye className="h-4 w-4 text-muted-foreground" />}
      />
      <StatCard
        title="Sessions"
        value={overview.totalSessions}
        subtitle="ユニークセッション数"
        icon={<Users className="h-4 w-4 text-muted-foreground" />}
      />
      <StatCard
        title="Avg Session Duration"
        value={formatDuration(overview.avgSessionDurationSeconds)}
        icon={<Clock className="h-4 w-4 text-muted-foreground" />}
      />
      <StatCard
        title="Entry Page Views"
        value={overview.entryPageViews}
        subtitle="/entries ページ"
        icon={<FileText className="h-4 w-4 text-muted-foreground" />}
      />
      <StatCard
        title="Jar Page Views"
        value={overview.jarPageViews}
        subtitle="/jar ページ"
        icon={<FlaskConical className="h-4 w-4 text-muted-foreground" />}
      />
    </div>
  );
}
