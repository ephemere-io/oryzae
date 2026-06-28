'use client';

import { useCallback } from 'react';

/**
 * SP「書く」フローの未確定ドラフトを localStorage に退避し、+ ボタンを押し直しても
 * 書きかけから再開できるようにする（Issue: 新規エントリの没頭前リスタート UX）。
 *
 * 復元の条件は「同じ暦日」かつ「最終編集から DRAFT_MAX_IDLE_MS 以内」。どちらかを外れたら
 * 古いドラフトは破棄し、+ は新規エントリとして開く。自動保存（10文字しきい値）の前後を
 * 問わず退避するため、保存される前の書きかけも失われない。発酵（瓶に納める）したら確定と
 * みなしてクリアする。
 */

const STORAGE_KEY = 'oryzae:sp:new-entry-draft';

/** 復元を許す「最終編集からの猶予」。これを超える / 日付をまたぐと新規エントリ扱いになる。 */
export const DRAFT_MAX_IDLE_MS = 60 * 60 * 1000; // 1 時間

export interface EntryDraft {
  /** 自動保存で既にエントリが作成済みならその id（再開時は同じエントリを更新＝重複作成を防ぐ）。 */
  entryId?: string;
  title: string;
  body: string;
  questionId: string | null;
  /** 最終編集時刻（epoch ms）。 */
  updatedAt: number;
  /** 最終編集時のローカル暦日（YYYY-MM-DD）。日付境界の判定に使う。 */
  dateKey: string;
}

/** ローカルタイムゾーンの暦日キー（YYYY-MM-DD）。 */
export function localDateKey(epochMs: number): string {
  const d = new Date(epochMs);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 同じ暦日 かつ 猶予時間以内 なら復元可。 */
export function isDraftFresh(
  draft: EntryDraft,
  nowMs: number,
  maxIdleMs: number = DRAFT_MAX_IDLE_MS,
): boolean {
  if (nowMs - draft.updatedAt > maxIdleMs) return false;
  if (draft.dateKey !== localDateKey(nowMs)) return false;
  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isEntryDraft(value: unknown): value is EntryDraft {
  if (!isRecord(value)) return false;
  return (
    (value.entryId === undefined || typeof value.entryId === 'string') &&
    typeof value.title === 'string' &&
    typeof value.body === 'string' &&
    (value.questionId === null || typeof value.questionId === 'string') &&
    typeof value.updatedAt === 'number' &&
    typeof value.dateKey === 'string'
  );
}

export function useEntryDraft() {
  /** 新鮮なドラフトのみ返す。古い / 壊れている場合は null（古いものは削除する）。 */
  const load = useCallback((): EntryDraft | null => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      if (!isEntryDraft(parsed)) {
        window.localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      if (!isDraftFresh(parsed, Date.now())) {
        window.localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }, []);

  const save = useCallback((draft: Omit<EntryDraft, 'updatedAt' | 'dateKey'>): void => {
    if (typeof window === 'undefined') return;
    const now = Date.now();
    const full: EntryDraft = { ...draft, updatedAt: now, dateKey: localDateKey(now) };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(full));
    } catch {
      // storage 不可（容量超過 / プライベートモード等）は無視する。
    }
  }, []);

  const clear = useCallback((): void => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // 無視
    }
  }, []);

  return { load, save, clear };
}
