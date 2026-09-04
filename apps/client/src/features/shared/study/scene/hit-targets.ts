/**
 * 当たり判定の対象づけ（`docs/oryzae-study/20-3d-component.md`「当たり判定」）。
 *
 * three.js の `Object3D` そのものではなく、**id と対象の対応表**だけを扱う純関数にしてある。
 * レイキャストの結果から対象を引く規則は、WebGL が無い環境でも試せる必要があるため。
 */

import { notebookTarget } from '../navigation';
import type { Notebook, StudyTarget } from '../types';

/** ヒットボックスに貼る識別子。`Object3D.userData.hitId` に入れる。 */
export type HitId = string;

export interface HitEntry {
  id: HitId;
  target: StudyTarget;
  /** ホバー時にラベルを濃くする対象（PC）。 */
  label: 'jar' | 'journal' | 'board' | 'archive' | null;
  /** 手帳と背表紙のツールチップに出す月。 */
  month: string | null;
}

/** ヒットボックスの一覧。id から対象を引く。 */
export class HitRegistry {
  private entries = new Map<HitId, HitEntry>();

  add(entry: HitEntry): void {
    this.entries.set(entry.id, entry);
  }

  get(id: HitId | undefined | null): HitEntry | null {
    if (typeof id !== 'string') return null;
    return this.entries.get(id) ?? null;
  }

  ids(): HitId[] {
    return [...this.entries.keys()];
  }

  clear(): void {
    this.entries.clear();
  }
}

/**
 * 書斎に置く的の一覧を組む。
 *
 * `desk` は机に積んだ冊（先頭が当月）、`shelf` は棚の背表紙。SP では棚を 1 つの的に
 * まとめる（背表紙 1 本は指より細く、当たりを広げると隣の月を拾ってしまう）。
 */
export function buildHitRegistry(options: {
  desk: readonly Notebook[];
  shelf: readonly Notebook[];
  hasLetter: boolean;
  /** SP は棚ごと 1 つの的にする。 */
  shelfAsSingleTarget: boolean;
}): HitRegistry {
  const registry = new HitRegistry();

  registry.add({ id: 'jar', target: { kind: 'jar' }, label: 'jar', month: null });

  if (options.hasLetter) {
    // 封は瓶とは別の的。押すと手紙が開いた状態で jar に入る。
    registry.add({
      id: 'seal',
      target: { kind: 'jar' },
      label: 'jar',
      month: null,
    });
  }

  options.desk.forEach((notebook, index) => {
    registry.add({
      id: `notebook-${index}`,
      target: notebookTarget(notebook.month, notebook.current),
      label: 'journal',
      month: notebook.month,
    });
  });

  if (options.shelfAsSingleTarget) {
    registry.add({ id: 'shelf', target: { kind: 'archive' }, label: 'archive', month: null });
  } else {
    options.shelf.forEach((notebook, index) => {
      registry.add({
        id: `spine-${index}`,
        target: { kind: 'journal-month', month: notebook.month },
        label: 'archive',
        month: notebook.month,
      });
    });
  }

  registry.add({ id: 'board', target: { kind: 'board' }, label: 'board', month: null });

  return registry;
}

/**
 * 封の対象を手紙の情報で差し替える。
 *
 * 的を組む時点では手紙の id が要らない（あるか無いかだけ）ので、受信箱が届いてから
 * ここで具体化する。
 */
export function sealTarget(letter: { fermentationId: string; questionId: string }): StudyTarget {
  return { kind: 'letter', fermentationId: letter.fermentationId, questionId: letter.questionId };
}

/**
 * クリック時に採る対象を決める。
 *
 * タッチ端末では `pointermove` が `click` より先に来ないことがあり、`hovered` が空のまま
 * になる。**`hovered` に頼らず、click の中で拾い直した結果を優先する。**
 */
export function resolveClickTarget(
  hovered: HitId | null,
  reRaycast: () => HitId | null,
): HitId | null {
  const picked = reRaycast();
  if (picked !== null) return picked;
  return hovered;
}

/** ホバーで的を少しだけ持ち上げる。色は変えない。 */
export const HOVER_SCALE = 1.02;
