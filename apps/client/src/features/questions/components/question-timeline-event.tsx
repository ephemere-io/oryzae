'use client';

type EventType = 'active' | 'proposed' | 'archived';

interface QuestionTimelineEventProps {
  id: string;
  text: string;
  eventType: EventType;
  onArchive: (id: string) => void;
  onUnarchive: (id: string) => void;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}

const EVENT_CONFIG: Record<
  EventType,
  { label: string; dotColor: string; borderColor: string; textColor: string; attribution: string }
> = {
  active: {
    label: '作成',
    dotColor: 'bg-amber-600',
    borderColor: 'border-l-amber-600',
    textColor: 'text-amber-600',
    attribution: 'ユーザーが作成',
  },
  proposed: {
    label: '提案',
    dotColor: 'bg-emerald-600',
    borderColor: 'border-l-emerald-600',
    textColor: 'text-emerald-600',
    attribution: 'Oryzae が提案',
  },
  archived: {
    label: 'アーカイブ',
    dotColor: 'bg-red-800',
    borderColor: 'border-l-red-800',
    textColor: 'text-red-800',
    attribution: 'ユーザーがアーカイブ',
  },
};

export function QuestionTimelineEvent({
  id,
  text,
  eventType,
  onArchive,
  onUnarchive,
  onAccept,
  onReject,
}: QuestionTimelineEventProps) {
  const config = EVENT_CONFIG[eventType];

  return (
    <div
      className={`ml-6 rounded-lg border-l-4 ${config.borderColor} bg-[rgba(200,180,140,0.08)] px-5 py-4`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${config.dotColor}`} />
            <span className={`text-xs font-bold ${config.textColor}`}>{config.label}</span>
          </div>
          <p className="text-base text-[var(--fg)]">→ {text}</p>
          <p className="text-xs text-[var(--date-color)]">{config.attribution}</p>
        </div>

        <div className="flex shrink-0 gap-2 pt-1">
          {eventType === 'proposed' ? (
            <>
              <button
                type="button"
                onClick={() => onAccept(id)}
                className="rounded-md bg-emerald-600 px-3 py-1 text-xs text-white hover:bg-emerald-700"
              >
                承認
              </button>
              <button
                type="button"
                onClick={() => onReject(id)}
                className="rounded-md border border-zinc-300 px-3 py-1 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                却下
              </button>
            </>
          ) : eventType === 'archived' ? (
            <button
              type="button"
              onClick={() => onUnarchive(id)}
              className="rounded-md border border-zinc-300 px-3 py-1 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              復元
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onArchive(id)}
              className="rounded-md border border-zinc-300 px-3 py-1 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              アーカイブ
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function deriveEventType(q: {
  isProposedByOryzae: boolean;
  isValidatedByUser: boolean;
  isArchived: boolean;
}): EventType {
  if (q.isProposedByOryzae && !q.isValidatedByUser) return 'proposed';
  if (q.isArchived) return 'archived';
  return 'active';
}
