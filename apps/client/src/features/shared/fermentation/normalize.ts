import type {
  FermentationDetail,
  FermentationKeyword,
  FermentationLetter,
  FermentationSnippet,
  FermentationSummary,
  FermentationWorksheet,
  JarPositioned,
  ScannedEntry,
} from '@/features/shared/fermentation/types';

/**
 * API レスポンスの正規化。
 *
 * Issue #490: 統合前は2実装のうち片方（pc/entries）だけが型ガードで正規化し、もう片方
 * （pc/fermentation）は素通しだった。**厳しい方に寄せる**方針で、共有側は常に正規化する。
 * 欠損フィールドは空文字/null に潰し、id を持たない要素は落とす。
 */

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function jarPos(raw: Record<string, unknown>): JarPositioned {
  return {
    jarX: typeof raw.jarX === 'number' ? raw.jarX : null,
    jarY: typeof raw.jarY === 'number' ? raw.jarY : null,
  };
}

function normalizeSnippets(input: unknown): FermentationSnippet[] {
  if (!Array.isArray(input)) return [];
  const out: FermentationSnippet[] = [];
  for (const raw of input) {
    if (!isObject(raw) || typeof raw.id !== 'string') continue;
    const snippetType =
      raw.snippetType === 'new_perspective' ||
      raw.snippetType === 'deepen' ||
      raw.snippetType === 'core'
        ? raw.snippetType
        : 'core';
    out.push({
      id: raw.id,
      snippetType,
      originalText: str(raw.originalText),
      sourceDate: str(raw.sourceDate),
      selectionReason: str(raw.selectionReason),
      ...jarPos(raw),
    });
  }
  return out;
}

function normalizeKeywords(input: unknown): FermentationKeyword[] {
  if (!Array.isArray(input)) return [];
  const out: FermentationKeyword[] = [];
  for (const raw of input) {
    if (!isObject(raw) || typeof raw.id !== 'string') continue;
    out.push({
      id: raw.id,
      keyword: str(raw.keyword),
      description: str(raw.description),
      ...jarPos(raw),
    });
  }
  return out;
}

function normalizeLetter(input: unknown): FermentationLetter | null {
  if (!isObject(input) || typeof input.id !== 'string') return null;
  return { id: input.id, bodyText: str(input.bodyText), ...jarPos(input) };
}

function normalizeWorksheet(input: unknown): FermentationWorksheet | null {
  if (!isObject(input) || typeof input.id !== 'string') return null;
  return {
    id: input.id,
    worksheetMarkdown: str(input.worksheetMarkdown),
    resultDiagramMarkdown: str(input.resultDiagramMarkdown),
  };
}

/** 手紙のもとになった記録。id と日付を欠くものは開けないので落とす（Issue #453）。 */
function normalizeScannedEntries(input: unknown): ScannedEntry[] {
  if (!Array.isArray(input)) return [];
  const out: ScannedEntry[] = [];
  for (const raw of input) {
    if (!isObject(raw) || typeof raw.id !== 'string') continue;
    if (typeof raw.createdAt !== 'string') continue;
    out.push({ id: raw.id, title: str(raw.title), createdAt: raw.createdAt });
  }
  return out;
}

/** 詳細レスポンスを正規化する。id / questionId を欠くものは null（＝表示しない）。 */
export function normalizeDetail(input: unknown): FermentationDetail | null {
  if (!isObject(input)) return null;
  if (typeof input.id !== 'string' || typeof input.questionId !== 'string') return null;
  return {
    id: input.id,
    questionId: input.questionId,
    targetPeriod: str(input.targetPeriod),
    status: str(input.status),
    worksheet: normalizeWorksheet(input.worksheet),
    snippets: normalizeSnippets(input.snippets),
    keywords: normalizeKeywords(input.keywords),
    letter: normalizeLetter(input.letter),
    scannedEntries: normalizeScannedEntries(input.scannedEntries),
  };
}

/** 一覧レスポンスを正規化する。必須フィールドを欠く要素は落とす。 */
export function normalizeSummaries(input: unknown): FermentationSummary[] {
  if (!Array.isArray(input)) return [];
  const out: FermentationSummary[] = [];
  for (const raw of input) {
    if (!isObject(raw)) continue;
    const { id, questionId, status, createdAt } = raw;
    if (
      typeof id !== 'string' ||
      typeof questionId !== 'string' ||
      typeof status !== 'string' ||
      typeof createdAt !== 'string'
    ) {
      continue;
    }
    out.push({ id, questionId, status, createdAt, targetPeriod: str(raw.targetPeriod) });
  }
  return out;
}
