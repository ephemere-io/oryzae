'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ApiClient } from '@/lib/api';

/**
 * Issue #329: 新規エントリで紐付けた問いに対応する最新の "completed" 発酵プロセス結果を
 * フェッチするフック。Jar 画面と同じ API を叩くが、features 境界を守るため
 * features/entries 内で独立に保持する (dep-cruiser のフィーチャ分離ルール準拠)。
 */

interface FermentationSnippet {
  id: string;
  snippetType: 'new_perspective' | 'deepen' | 'core';
  originalText: string;
  sourceDate: string;
  selectionReason: string;
}

interface FermentationKeyword {
  id: string;
  keyword: string;
  description: string;
}

interface FermentationLetter {
  id: string;
  bodyText: string;
}

export interface EntryFermentationDetail {
  id: string;
  questionId: string;
  snippets: FermentationSnippet[];
  keywords: FermentationKeyword[];
  letter: FermentationLetter | null;
}

interface FermentationSummary {
  id: string;
  questionId: string;
  status: string;
  createdAt: string;
}

interface ApiSnippet {
  id?: unknown;
  snippetType?: unknown;
  originalText?: unknown;
  sourceDate?: unknown;
  selectionReason?: unknown;
}

interface ApiKeyword {
  id?: unknown;
  keyword?: unknown;
  description?: unknown;
}

interface ApiLetter {
  id?: unknown;
  bodyText?: unknown;
}

interface ApiDetail {
  id?: unknown;
  questionId?: unknown;
  status?: unknown;
  snippets?: unknown;
  keywords?: unknown;
  letter?: unknown;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeSnippets(input: unknown): FermentationSnippet[] {
  if (!Array.isArray(input)) return [];
  const out: FermentationSnippet[] = [];
  for (const raw of input) {
    if (!isObject(raw)) continue;
    const s = raw as ApiSnippet;
    if (typeof s.id !== 'string') continue;
    const snippetType =
      s.snippetType === 'new_perspective' || s.snippetType === 'deepen' || s.snippetType === 'core'
        ? s.snippetType
        : 'core';
    out.push({
      id: s.id,
      snippetType,
      originalText: typeof s.originalText === 'string' ? s.originalText : '',
      sourceDate: typeof s.sourceDate === 'string' ? s.sourceDate : '',
      selectionReason: typeof s.selectionReason === 'string' ? s.selectionReason : '',
    });
  }
  return out;
}

function normalizeKeywords(input: unknown): FermentationKeyword[] {
  if (!Array.isArray(input)) return [];
  const out: FermentationKeyword[] = [];
  for (const raw of input) {
    if (!isObject(raw)) continue;
    const k = raw as ApiKeyword;
    if (typeof k.id !== 'string') continue;
    out.push({
      id: k.id,
      keyword: typeof k.keyword === 'string' ? k.keyword : '',
      description: typeof k.description === 'string' ? k.description : '',
    });
  }
  return out;
}

function normalizeLetter(input: unknown): FermentationLetter | null {
  if (!isObject(input)) return null;
  const l = input as ApiLetter;
  if (typeof l.id !== 'string') return null;
  return {
    id: l.id,
    bodyText: typeof l.bodyText === 'string' ? l.bodyText : '',
  };
}

function normalizeDetail(input: unknown): EntryFermentationDetail | null {
  if (!isObject(input)) return null;
  const d = input as ApiDetail;
  if (typeof d.id !== 'string' || typeof d.questionId !== 'string') return null;
  if (d.status !== 'completed') return null;
  return {
    id: d.id,
    questionId: d.questionId,
    snippets: normalizeSnippets(d.snippets),
    keywords: normalizeKeywords(d.keywords),
    letter: normalizeLetter(d.letter),
  };
}

function normalizeSummaries(input: unknown): FermentationSummary[] {
  if (!Array.isArray(input)) return [];
  const out: FermentationSummary[] = [];
  for (const raw of input) {
    if (!isObject(raw)) continue;
    const id = raw.id;
    const questionId = raw.questionId;
    const status = raw.status;
    const createdAt = raw.createdAt;
    if (
      typeof id !== 'string' ||
      typeof questionId !== 'string' ||
      typeof status !== 'string' ||
      typeof createdAt !== 'string'
    ) {
      continue;
    }
    out.push({ id, questionId, status, createdAt });
  }
  return out;
}

interface UseEntryFermentationDetailResult {
  detail: EntryFermentationDetail | null;
  loading: boolean;
}

/**
 * Returns the latest completed fermentation detail for `questionId`, or null if none exists.
 * Returns null while `questionId` is undefined.
 */
export function useEntryFermentationDetail(
  api: ApiClient | null,
  questionId: string | undefined,
): UseEntryFermentationDetailResult {
  const [detail, setDetail] = useState<EntryFermentationDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchDetail = useCallback(async () => {
    if (!api || !questionId) {
      setDetail(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setDetail(null);
    try {
      const res = await api.fetch(`/api/v1/fermentations?questionId=${questionId}`);
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const summaries = normalizeSummaries(await res.json());
      const completed = summaries
        .filter((s) => s.status === 'completed')
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      if (!completed) {
        setLoading(false);
        return;
      }
      const detailRes = await api.fetch(`/api/v1/fermentations/${completed.id}`);
      if (!detailRes.ok) {
        setLoading(false);
        return;
      }
      const normalized = normalizeDetail(await detailRes.json());
      setDetail(normalized);
    } finally {
      setLoading(false);
    }
  }, [api, questionId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  return { detail, loading };
}
