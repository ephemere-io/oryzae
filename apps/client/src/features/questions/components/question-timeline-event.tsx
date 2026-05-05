'use client';

import { useTranslations } from 'next-intl';

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

const EVENT_STYLES: Record<
  EventType,
  { dotColor: string; borderColor: string; textColor: string }
> = {
  active: {
    dotColor: 'bg-amber-600',
    borderColor: 'border-l-amber-600',
    textColor: 'text-amber-600',
  },
  proposed: {
    dotColor: 'bg-emerald-600',
    borderColor: 'border-l-emerald-600',
    textColor: 'text-emerald-600',
  },
  archived: {
    dotColor: 'bg-red-800',
    borderColor: 'border-l-red-800',
    textColor: 'text-red-800',
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
  const t = useTranslations('questions.event');
  const styles = EVENT_STYLES[eventType];

  const label =
    eventType === 'active'
      ? t('label_active')
      : eventType === 'proposed'
        ? t('label_proposed')
        : t('label_archived');

  const attribution =
    eventType === 'active'
      ? t('attribution_active')
      : eventType === 'proposed'
        ? t('attribution_proposed')
        : t('attribution_archived');

  return (
    <div
      className={`rounded-[10px] border-l-[3px] ${styles.borderColor} bg-[rgba(200,180,140,0.08)] px-5 py-3.5`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          {/* Event type label */}
          <div className="flex items-center gap-2">
            <span className={`inline-block h-2 w-2 rounded-full ${styles.dotColor}`} />
            <span className={`text-[11px] font-bold ${styles.textColor}`}>{label}</span>
          </div>

          {/* Question text */}
          <p
            className="text-[14px] leading-[1.7] text-[var(--fg)]"
            style={{ fontFamily: "'Noto Serif JP', serif" }}
          >
            → {text}
          </p>

          {/* Attribution */}
          <p className="text-[11px] text-[var(--date-color)]">{attribution}</p>
        </div>

        {/* Action buttons - subtle styling */}
        <div className="flex shrink-0 gap-2 pt-1">
          {eventType === 'proposed' ? (
            <>
              <button
                type="button"
                onClick={() => onAccept(id)}
                className="rounded-full bg-emerald-600 px-3 py-1 text-[11px] text-white transition-colors hover:bg-emerald-700"
              >
                {t('accept')}
              </button>
              <button
                type="button"
                onClick={() => onReject(id)}
                className="rounded-full border border-[var(--border-subtle)] px-3 py-1 text-[11px] text-[var(--date-color)] transition-colors hover:bg-[rgba(200,180,140,0.1)]"
              >
                {t('reject')}
              </button>
            </>
          ) : eventType === 'archived' ? (
            <button
              type="button"
              onClick={() => onUnarchive(id)}
              className="rounded-full border border-[var(--border-subtle)] px-3 py-1 text-[11px] text-[var(--date-color)] transition-colors hover:bg-[rgba(200,180,140,0.1)]"
            >
              {t('unarchive')}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onArchive(id)}
              className="rounded-full border border-[var(--border-subtle)] px-3 py-1 text-[11px] text-[var(--date-color)] transition-colors hover:bg-[rgba(200,180,140,0.1)]"
            >
              {t('archive')}
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
