import type { EntryLinkedQuestion, EntryListItem } from '@/features/shared/entries/types';

/**
 * 一覧レスポンスの正規化。
 *
 * Issue #323: サーバーは `linkedQuestions` を必ず配列で返すが、未デプロイ時や
 * テストモックの取りこぼしを許容してフォールバックしておく。
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

export function normalizeEntry(raw: unknown): EntryListItem {
  const r = isRecord(raw) ? raw : {};
  const rawLinked = Array.isArray(r.linkedQuestions) ? r.linkedQuestions : [];
  const linkedQuestions: EntryLinkedQuestion[] = rawLinked.filter(isRecord).map((q) => ({
    id: String(q.id ?? ''),
    currentText: typeof q.currentText === 'string' ? q.currentText : null,
  }));
  return {
    id: String(r.id ?? ''),
    userId: String(r.userId ?? ''),
    content: typeof r.content === 'string' ? r.content : '',
    mediaUrls: Array.isArray(r.mediaUrls) ? r.mediaUrls.map((u) => String(u)) : [],
    createdAt: String(r.createdAt ?? ''),
    updatedAt: String(r.updatedAt ?? ''),
    linkedQuestions,
  };
}

/** 一覧が返すリスト全体。配列でないレスポンスでも落ちない。 */
export function normalizeEntries(raw: unknown): EntryListItem[] {
  return (Array.isArray(raw) ? raw : []).map(normalizeEntry);
}
