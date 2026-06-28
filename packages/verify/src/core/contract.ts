/**
 * DOM契約: `data-verify-*` 属性。
 *
 * 各コンポーネントは自分の状態を `data-verify-*` 属性として公表し、レンダリング後の
 * DOM 自体を機械可読なグラウンドトゥルースにする。検証器やエージェントは React 内部
 * ではなくこの契約を読むため、リファクタしても表面が安定する。
 *
 * 例: <li data-verify-unit="EntryCard" data-verify-status="draft" ...>
 */

export const VERIFY_PREFIX = 'data-verify-';

/** プレーンなレコードから `data-verify-*` props オブジェクトを組み立てる。 */
export function verifyAttrs(
  attrs: Record<string, string | number | boolean | null | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined) continue;
    // camelCase → kebab。DOM は属性名を小文字化するので、camelCase のままだと
    // data-verify-inFlight → data-verify-inflight に潰れて読み戻せない。kebab で往復させる。
    const kebab = key.replace(/([A-Z])/g, '-$1').toLowerCase();
    out[`${VERIFY_PREFIX}${kebab}`] = String(value);
  }
  return out;
}

/** `root`（または内部の最初の契約要素）から `data-verify-*` をフラットなマップで読む。 */
export function readContract(root: HTMLElement): Record<string, string> {
  const el = findContractRoot(root);
  if (!el) return {};
  return collect(el);
}

/** すべての契約要素から契約を読む（リスト/feature 用）。 */
export function readAllContracts(root: HTMLElement): Record<string, string>[] {
  const els = root.querySelectorAll<HTMLElement>(`[${VERIFY_PREFIX}unit]`);
  return Array.from(els).map(collect);
}

function collect(el: HTMLElement): Record<string, string> {
  const out: Record<string, string> = {};
  for (const attr of Array.from(el.attributes)) {
    if (attr.name.startsWith(VERIFY_PREFIX)) {
      // kebab → camelCase（verifyAttrs の逆変換）。data-verify-in-flight → inFlight。
      const raw = attr.name.slice(VERIFY_PREFIX.length);
      const camel = raw.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
      out[camel] = attr.value;
    }
  }
  return out;
}

function findContractRoot(root: HTMLElement): HTMLElement | null {
  if (root.hasAttribute(`${VERIFY_PREFIX}unit`)) return root;
  return root.querySelector<HTMLElement>(`[${VERIFY_PREFIX}unit]`);
}
