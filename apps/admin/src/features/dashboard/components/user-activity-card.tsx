'use client';

interface UserActivityCardProps {
  activeWriters: number;
  totalUsers: number;
}

export function UserActivityCard({ activeWriters, totalUsers }: UserActivityCardProps) {
  const ratio = totalUsers > 0 ? (activeWriters / totalUsers) * 100 : 0;

  return (
    <div className="flex flex-col justify-between rounded-lg border border-border/50 bg-card p-4">
      <div>
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          Active Writers (7d)
        </span>
        <div className="text-3xl font-semibold tracking-tight mt-0.5">
          {activeWriters}
          <span className="text-lg font-normal text-muted-foreground">/{totalUsers}</span>
        </div>
      </div>
      <div className="mt-3">
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-green-500 transition-all"
            style={{ width: `${ratio}%` }}
          />
        </div>
      </div>
    </div>
  );
}
