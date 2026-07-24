/**
 * エージェントハンドル: window.__verify。
 *
 * 「検証器のための表面」。AI エージェントや Playwright が `window.__verify.manifest()` で
 * 全ユニット×fixture を発見し、孤立ルートへ移動し、`window.__verify.current()` で構造化
 * VerifyResult を得られる。DOM スクレイピングのヒューリスティック不要。
 */

import { allUnits, buildManifest } from '../core/registry';
import { runUnit } from '../core/runner';
import type { VerifyHandle, VerifyResult } from '../core/types';

let currentResult: VerifyResult | null = null;

export function setCurrentResult(r: VerifyResult | null): void {
  currentResult = r;
  // DOM しか読めないエージェント向けに、発見しやすい場所にも置く。
  if (typeof document === 'undefined') return;
  const host = document.getElementById('verify-result-json');
  if (host) host.textContent = r ? JSON.stringify(r, null, 2) : '';
}

export function installVerifyHandle(): VerifyHandle {
  const handle: VerifyHandle = {
    version: '1.0',
    manifest: () => buildManifest(),
    current: () => currentResult,
    runAll: async () => {
      const out: VerifyResult[] = [];
      for (const unit of allUnits()) {
        out.push(...(await runUnit(unit)));
      }
      return out;
    },
  };
  window.__verify = handle;
  return handle;
}
