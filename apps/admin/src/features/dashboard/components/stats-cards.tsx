'use client';

import {
  AlertTriangle,
  CheckCircle,
  DollarSign,
  FileText,
  FlaskConical,
  Users,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DashboardStats } from '../hooks/use-dashboard-stats';

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

export function StatsCards({ stats }: { stats: DashboardStats }) {
  const successRate =
    stats.totalFermentations > 0
      ? Math.round((stats.completedFermentations / stats.totalFermentations) * 100)
      : 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <StatCard
        title="Users"
        value={stats.totalUsers}
        icon={<Users className="h-4 w-4 text-muted-foreground" />}
      />
      <StatCard
        title="Entries"
        value={stats.totalEntries}
        icon={<FileText className="h-4 w-4 text-muted-foreground" />}
      />
      <StatCard
        title="Fermentations"
        value={stats.totalFermentations}
        subtitle={`${stats.completedFermentations} completed / ${stats.failedFermentations} failed`}
        icon={<FlaskConical className="h-4 w-4 text-muted-foreground" />}
      />
      <StatCard
        title="Success Rate"
        value={`${successRate}%`}
        subtitle={successRate < 80 ? 'Below target (80%)' : 'Healthy'}
        icon={
          successRate < 80 ? (
            <AlertTriangle className="h-4 w-4 text-destructive" />
          ) : (
            <CheckCircle className="h-4 w-4 text-green-600" />
          )
        }
      />
      <StatCard
        title="Cost Tracked"
        value={stats.fermentationsWithCostTracking}
        subtitle="Fermentations with Gateway data"
        icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
      />
    </div>
  );
}
