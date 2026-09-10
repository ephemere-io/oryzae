/**
 * 端末(reach)判定の基盤。device はフロントだけの軸であり、ここはドメインを知らない
 * 横断インフラとして lib に置く（docs/client-architecture-guide.md）。
 *
 * - `device` cookie       … middleware が UA から付与する判定結果
 * - `device-pref` cookie  … ユーザーの手動切替（"PC版/スマホ版を見る"）。あれば優先
 * - `?device=pc|sp|auto`  … その手動切替を URL から行う（`auto` は解除）
 */
export type Device = 'pc' | 'sp';

export const DEVICE_COOKIE = 'device';
export const DEVICE_PREF_COOKIE = 'device-pref';

export function isDevice(value: string | undefined | null): value is Device {
  return value === 'pc' || value === 'sp';
}

/** User-Agent からの素朴な端末判定（middleware 用）。iPad 等は当面 pc 扱い。 */
export function detectDeviceFromUA(userAgent: string | null): Device {
  if (!userAgent) return 'pc';
  return /Mobile|Android|iPhone|iPod|Windows Phone/i.test(userAgent) ? 'sp' : 'pc';
}

/**
 * 端末の最終解決。手動切替(device-pref)が妥当ならそれを優先し、無ければ UA 判定。
 * middleware から呼ぶ純関数として切り出し、precedence をユニットテスト可能にする。
 */
export function resolveDevice(pref: string | undefined | null, userAgent: string | null): Device {
  return isDevice(pref) ? pref : detectDeviceFromUA(userAgent);
}

/** `?device=` の指示。端末名は固定、`auto` は解除、それ以外は指示なし。 */
export type DeviceRequest = Device | 'auto' | null;

/**
 * `?device=` の値を読む。
 *
 * PC と SP を見比べたいとき（レビュー・不具合報告）、これが無いと DevTools の
 * Console で cookie を手で書いてリロードするしかない。`?study=on` と同じ操作感にする。
 *
 * `auto` を用意するのは、**入る道だけあって出る道が無い切替を作らない**ため。
 * 一度 sp に固定した端末が UA 判定へ戻れなくなると、その端末は以後ずっと嘘の
 * 見え方をする。
 */
export function parseDeviceRequest(value: string | undefined | null): DeviceRequest {
  if (isDevice(value)) return value;
  return value === 'auto' ? 'auto' : null;
}
