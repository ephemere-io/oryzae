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

/**
 * ホバーで出す一言の種類。
 *
 * 中身を数えて言える的にだけ付ける。**ラベルは名前しか言わない** — `BOARD` と出ている
 * だけでは中に何が貼ってあるか分からず、実機レビューで「ボードにホバーしても何も
 * 出ない」と報告された。手帳と背表紙は月ごとの `StudyTooltip` が別に出るので、
 * ここには入れない（同じ場所に 2 枚出てしまう）。
 */
export type HitHint = 'pen' | 'jar' | 'board';

export interface HitEntry {
  id: HitId;
  target: StudyTarget;
  /** ホバー時にラベルを濃くする対象（PC）。 */
  label: 'jar' | 'journal' | 'board' | 'archive' | null;
  /** 手帳と背表紙のツールチップに出す月。 */
  month: string | null;
  /** ホバーで出す一言。出す文面は呼び出し側が状態から決める。 */
  hint?: HitHint;
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
  /** SP は棚ごと 1 つの的にする。 */
  shelfAsSingleTarget: boolean;
}): HitRegistry {
  const registry = new HitRegistry();

  registry.add({ id: 'jar', target: { kind: 'jar' }, label: 'jar', month: null, hint: 'jar' });

  options.desk.forEach((notebook, index) => {
    registry.add({
      id: `notebook-${index}`,
      target: notebookTarget(notebook.month),
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

  /**
   * 鉛筆。押すと新しいエントリーを書き始める。
   *
   * 机の上の物がひととおり押せる中で**鉛筆だけが押せず、存在が浮いていた**
   * （実機レビュー）。行き先は積みの一番上（当月）と同じ「書く」で、
   * 物として最も素直に「書く」を指しているのが鉛筆。
   */
  registry.add({
    id: 'pen',
    target: { kind: 'journal-new' },
    // ラベルは持たせない。積みの JOURNAL と同じ場所に 2 つ目の注釈が出てしまう。
    label: null,
    month: null,
    hint: 'pen',
  });

  registry.add({
    id: 'board',
    target: { kind: 'board' },
    label: 'board',
    month: null,
    hint: 'board',
  });

  return registry;
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
