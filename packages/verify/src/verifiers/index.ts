/**
 * ビルトイン verifier の登録。
 * 各 verifier はモジュール読み込み時に自己登録する。この関数はそれらを参照することで
 * バンドラのツリーシェイクを防ぎ、明示的な登録 API を提供する。
 * 新種を足す = ファイルを足してここに1行足すだけ。コンポーネントは無改変。
 */

import type { Verifier } from '../core/types';
import { a11yVerifier } from './a11y';
import { domContractVerifier } from './dom-contract';
import { invariantVerifier } from './invariants';
import { schemaVerifier } from './schema';

export function registerBuiltinVerifiers(): readonly Verifier[] {
  return [schemaVerifier, invariantVerifier, domContractVerifier, a11yVerifier];
}
