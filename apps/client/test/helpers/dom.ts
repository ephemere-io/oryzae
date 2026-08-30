/**
 * `el.closest('button')` は `HTMLButtonElement | null` を返す。テストでは「無ければ
 * そこで落としたい」ので、`as HTMLButtonElement` で null を握り潰す代わりに
 * 明示的に投げる。どのセレクタで見つからなかったかが失敗メッセージに残る。
 */
export function closestOrThrow<K extends keyof HTMLElementTagNameMap>(
  el: Element,
  selector: K,
): HTMLElementTagNameMap[K] {
  const found = el.closest(selector);
  if (!found) {
    throw new Error(`closest('${selector}') が見つかりませんでした`);
  }
  return found;
}
