'use client';

import { useUserStats } from '@/features/auth/hooks/use-user-stats';

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg p-4" style={{ border: '1px solid var(--border-subtle)' }}>
      <p
        className="text-xs font-medium uppercase tracking-[0.1em]"
        style={{ color: 'var(--date-color)', fontFamily: 'Inter, sans-serif' }}
      >
        {label}
      </p>
      <p className="mt-1 text-lg font-bold" style={{ color: 'var(--fg)' }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      {sub && (
        <p className="mt-0.5 text-xs" style={{ color: 'var(--date-color)' }}>
          {sub}
        </p>
      )}
    </div>
  );
}

export function WritingStats() {
  const { stats, loading } = useUserStats();

  if (loading) return null;

  if (!stats) return null;

  const maxMonthlyChars = Math.max(...stats.monthlyTrend.map((m) => m.chars), 1);

  return (
    <div className="flex flex-col gap-6">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="連続記録" value={`${stats.streak}日`} />
        <StatCard label="累計エントリ" value={stats.totalEntries} />
        <StatCard label="累計文字数" value={stats.totalChars} />
        <StatCard label="発酵回数" value={stats.totalFermentations} />
        <StatCard label="今週の文字数" value={stats.weeklyChars} />
        <StatCard label="今月の文字数" value={stats.monthlyChars} />
      </div>

      {/* Monthly trend */}
      <div>
        <p
          className="mb-3 text-xs font-medium uppercase tracking-[0.1em]"
          style={{ color: 'var(--date-color)', fontFamily: 'Inter, sans-serif' }}
        >
          月別推移
        </p>
        <div className="flex flex-col gap-1">
          {stats.monthlyTrend.map((m) => (
            <div key={m.month} className="flex items-center gap-2 text-xs">
              <span className="w-14 text-right" style={{ color: 'var(--date-color)' }}>
                {m.month.slice(2)}
              </span>
              <div
                className="h-4 flex-1 overflow-hidden rounded-sm"
                style={{ backgroundColor: 'var(--border-subtle)' }}
              >
                <div
                  className="h-full rounded-sm"
                  style={{
                    width: `${(m.chars / maxMonthlyChars) * 100}%`,
                    backgroundColor: 'var(--accent)',
                    opacity: 0.6,
                  }}
                />
              </div>
              <span className="w-16 text-right font-mono" style={{ color: 'var(--fg)' }}>
                {m.chars.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Entries by question */}
      {stats.entriesByQuestion.length > 0 && (
        <div>
          <p
            className="mb-3 text-xs font-medium uppercase tracking-[0.1em]"
            style={{ color: 'var(--date-color)', fontFamily: 'Inter, sans-serif' }}
          >
            問い別エントリ数
          </p>
          <div className="flex flex-col gap-2">
            {stats.entriesByQuestion.map((q) => (
              <div key={q.questionId} className="flex items-center justify-between text-sm">
                <span className="truncate pr-4" style={{ color: 'var(--fg)' }}>
                  {q.questionText || '(無題)'}
                </span>
                <span className="shrink-0 font-mono" style={{ color: 'var(--date-color)' }}>
                  {q.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
