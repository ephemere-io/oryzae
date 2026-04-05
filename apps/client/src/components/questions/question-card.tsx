'use client';

import type { ApiClient } from '@/lib/api';

interface QuestionCardProps {
  id: string;
  text: string;
  isArchived: boolean;
  isProposedByOryzae: boolean;
  isValidatedByUser: boolean;
  api: ApiClient;
  onUpdate: () => void;
}

export function QuestionCard({
  id,
  text,
  isArchived,
  isProposedByOryzae,
  isValidatedByUser,
  api,
  onUpdate,
}: QuestionCardProps) {
  async function handleArchive() {
    await api.api.v1.questions[':id'].archive.$post({ param: { id } });
    onUpdate();
  }

  async function handleUnarchive() {
    await api.api.v1.questions[':id'].unarchive.$post({ param: { id } });
    onUpdate();
  }

  async function handleAccept() {
    await api.api.v1.questions[':id'].accept.$post({ param: { id } });
    onUpdate();
  }

  async function handleReject() {
    await api.api.v1.questions[':id'].reject.$post({ param: { id } });
    onUpdate();
  }

  const isPending = isProposedByOryzae && !isValidatedByUser;

  return (
    <div className="flex items-center justify-between rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-zinc-900 dark:text-zinc-100">{text}</p>
        <div className="flex gap-2">
          {isPending && <span className="text-xs text-amber-600">Oryzae からの提案</span>}
          {isArchived && <span className="text-xs text-zinc-400">アーカイブ済み</span>}
        </div>
      </div>

      <div className="flex gap-2">
        {isPending ? (
          <>
            <button
              type="button"
              onClick={handleAccept}
              className="rounded-md bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-700"
            >
              承認
            </button>
            <button
              type="button"
              onClick={handleReject}
              className="rounded-md border border-zinc-300 px-3 py-1 text-xs hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              却下
            </button>
          </>
        ) : isArchived ? (
          <button
            type="button"
            onClick={handleUnarchive}
            className="rounded-md border border-zinc-300 px-3 py-1 text-xs hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            復元
          </button>
        ) : (
          <button
            type="button"
            onClick={handleArchive}
            className="rounded-md border border-zinc-300 px-3 py-1 text-xs hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            アーカイブ
          </button>
        )}
      </div>
    </div>
  );
}
