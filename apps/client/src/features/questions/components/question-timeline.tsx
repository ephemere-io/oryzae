'use client';

import {
  deriveEventType,
  QuestionTimelineEvent,
} from '@/features/questions/components/question-timeline-event';

interface QuestionItem {
  id: string;
  currentText: string | null;
  isArchived: boolean;
  isProposedByOryzae: boolean;
  isValidatedByUser: boolean;
  createdAt: string;
  updatedAt: string;
}

interface QuestionTimelineProps {
  questions: QuestionItem[];
  onArchive: (id: string) => void;
  onUnarchive: (id: string) => void;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}

function groupByDate(questions: QuestionItem[]): Map<string, QuestionItem[]> {
  const groups = new Map<string, QuestionItem[]>();
  const sorted = [...questions].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  for (const q of sorted) {
    const d = new Date(q.updatedAt);
    const key = `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
    const group = groups.get(key);
    if (group) {
      group.push(q);
    } else {
      groups.set(key, [q]);
    }
  }
  return groups;
}

export function QuestionTimeline({
  questions,
  onArchive,
  onUnarchive,
  onAccept,
  onReject,
}: QuestionTimelineProps) {
  const groups = groupByDate(questions);

  if (questions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-[var(--date-color)]">
        <p className="text-sm">問いはまだありません</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Header */}
      <div className="mb-12 text-center">
        <h2
          className="text-[22px] font-bold tracking-[0.12em] text-[var(--fg)]"
          style={{ fontFamily: "'Noto Serif JP', serif" }}
        >
          問いの変遷
        </h2>
        <p className="mt-3 text-[13px] tracking-[0.08em] text-[var(--date-color)]">
          あなたの問いが生まれ、育ち、変化してきた記録
        </p>
      </div>

      {/* Timeline */}
      <div className="relative pl-8">
        {/* Vertical line */}
        <div className="absolute left-[7px] top-0 bottom-0 w-0.5 bg-[rgba(139,115,85,0.15)]" />

        {[...groups.entries()].map(([dateLabel, items]) => (
          <div key={dateLabel} className="mb-10">
            {/* Date label with dot */}
            <div className="relative mb-4 flex items-center">
              <div className="absolute -left-[22px] h-2.5 w-2.5 rounded-full bg-[var(--fg)]" />
              <span
                className="text-[11px] font-semibold tracking-[0.15em] text-[var(--date-color)]"
                style={{ fontFamily: 'Inter, sans-serif' }}
              >
                {dateLabel}
              </span>
            </div>

            {/* Events */}
            <div className="flex flex-col gap-2.5">
              {items.map((q) => (
                <QuestionTimelineEvent
                  key={q.id}
                  id={q.id}
                  text={q.currentText ?? ''}
                  eventType={deriveEventType(q)}
                  onArchive={onArchive}
                  onUnarchive={onUnarchive}
                  onAccept={onAccept}
                  onReject={onReject}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
