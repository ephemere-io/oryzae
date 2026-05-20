import { type EditorEffectsState, editorEffectsStateSchema } from '@oryzae/shared';

/**
 * localStorage キャッシュ層。
 * DB が SSoT、これは「保存直後の即時反映 / 取得待ちの隙間に過去の effects を見せる」
 * ための warm cache。Issue #332 参照。
 *
 * 失敗（quota 超過 / SSR / 私的閲覧モード等）は黙って握る。
 *
 * 読み込み時は必ず Zod schema で validate する。理由: 永続化機能の開発過程で
 * textSpans の time variant の形が `{t, duration}` から `{fontSize}` / `{fontWeight}`
 * に変わったため、古いキャッシュが残っているとレンダリングが壊れる (`undefinedpx`
 * になって text が小さくなる等)。schema mismatch なキャッシュは捨てて DB から
 * fetch し直す。
 */

const PREFIX = 'oryzae-entry-effects:';

export function loadCachedEffects(entryId: string | undefined): EditorEffectsState | null {
  if (!entryId || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PREFIX + entryId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    const validated = editorEffectsStateSchema.safeParse(parsed);
    if (!validated.success) {
      // Outdated / malformed cache — drop it so we don't apply broken styles
      // (e.g. old `{t, duration}` shape would render `undefinedpx`).
      window.localStorage.removeItem(PREFIX + entryId);
      return null;
    }
    return validated.data;
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
