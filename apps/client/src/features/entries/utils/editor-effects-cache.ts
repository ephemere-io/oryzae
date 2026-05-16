import type { EditorEffectsState } from '@oryzae/shared';

/**
 * localStorage キャッシュ層。
 * DB が SSoT、これは「保存直後の即時反映 / 取得待ちの隙間に過去の effects を見せる」
 * ための warm cache。Issue #332 参照。
 *
 * 失敗（quota 超過 / SSR / 私的閲覧モード等）は黙って握る。
 */

const PREFIX = 'oryzae-entry-effects:';

export function loadCachedEffects(entryId: string | undefined): EditorEffectsState | null {
  if (!entryId || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PREFIX + entryId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as EditorEffectsState;
  } catch {
    return null;
  }
}

export function saveCachedEffects(
  entryId: string | undefined,
  effects: EditorEffectsState | null,
): void {
  if (!entryId || typeof window === 'undefined') return;
  try {
    if (effects == null) {
      window.localStorage.removeItem(PREFIX + entryId);
      return;
    }
    window.localStorage.setItem(PREFIX + entryId, JSON.stringify(effects));
  } catch {
    // ignore (quota etc.)
  }
}
