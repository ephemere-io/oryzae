/**
 * @oryzae/verify — 検証ハーネスのエンジン。
 * 詳しい横展開ガイドは docs/verify-harness-rollout.md を参照。
 */

export { readAllContracts, readContract, VERIFY_PREFIX, verifyAttrs } from './core/contract';
export {
  allUnits,
  allVerifiers,
  buildManifest,
  getUnit,
  getVerifier,
  registerUnit,
  registerVerifier,
  verifiersFor,
} from './core/registry';
export { makeActContext, type RunOptions, runFixture, runUnit, verdictOf } from './core/runner';
export type {
  ActContext,
  Check,
  CheckStatus,
  Fixture,
  Invariant,
  InvariantContext,
  Verdict,
  VerifiableUnit,
  Verifier,
  VerifierContext,
  VerifyHandle,
  VerifyManifestEntry,
  VerifyResult,
} from './core/types';
export { VerifyDashboard } from './harness/Dashboard';
export { installVerifyHandle, setCurrentResult } from './harness/handle';
export { VerifyUnitPage } from './harness/UnitPage';
export { registerBuiltinVerifiers } from './verifiers';
