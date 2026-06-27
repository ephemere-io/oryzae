/**
 * 検証フレームワークのコア型。
 *
 * 設計原則:
 *  - 検証は「表面（レンダリング後のDOM）での実行時観測」。静的解析やユニットテストではない。
 *  - verdict は PASS / FAIL / BLOCKED / SKIP。BLOCKED（観測不能）は FAIL（観測して不正）と区別する。
 *  - 各ユニットは fixture（名前付き再現状態）を宣言する。`probe: true` はハッピーパスを外した
 *    敵対的ケース（🔍）。
 *  - verifier はプラグイン。マウント済みユニットを検査し Check を返す。新種の verifier は
 *    コンポーネントを触らずに追加できる。
 *  - 出力は機械可読 JSON が第一、人間向けダッシュボードが第二。
 */

import type { ReactElement } from 'react';
import type { ZodTypeAny } from 'zod';

/* -------------------------------------------------------------------------- */
/* Verdict & Check                                                            */
/* -------------------------------------------------------------------------- */

export type Verdict = 'PASS' | 'FAIL' | 'BLOCKED' | 'SKIP';

/**
 * 1つの観測。4分類のステータス:
 *  ok    (✅) — 確認
 *  fail  (❌) — 観測して不正
 *  warn  (⚠️) — 懸念あり（不合格ではない）
 *  probe (🔍) — ハッピーパス外のストレスケースが成立した
 */
export type CheckStatus = 'ok' | 'fail' | 'warn' | 'probe';

export interface Check {
  /** どの verifier が生成したか（例 "schema", "invariants"）。 */
  verifier: string;
  status: CheckStatus;
  /** 何を確認したかの短いラベル。 */
  label: string;
  /** 任意の詳細（実測値 vs 期待値など）。 */
  detail?: string;
  /** 任意の生の証拠（シリアライズ可能）。 */
  evidence?: unknown;
}

/** 1つのユニット×fixture に全 verifier を回した結果。 */
export interface VerifyResult {
  unitId: string;
  fixtureId: string;
  verdict: Verdict;
  checks: Check[];
  /** 実行時点の DOM 契約のスナップショット。 */
  domSnapshot: Record<string, string>;
  /** 実行のウォールクロック時間（ms）。 */
  durationMs: number;
  /** BLOCKED の場合、なぜ観測できなかったか。 */
  blockedReason?: string;
  timestamp: string;
}

/* -------------------------------------------------------------------------- */
/* Fixture                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Fixture は名前付きの再現可能なレンダリング設定。
 * `probe: true` は敵対的/エッジケース（🔍）。probe が0個のユニットはハッピーパスしか
 * 再生していない。
 */
export interface Fixture<P = unknown> {
  id: string;
  /** シナリオの一行説明。 */
  description: string;
  /** ユニットをマウントする props。 */
  props: P;
  /** ハッピーパス外/ストレス fixture として印を付ける。 */
  probe?: boolean;
  /**
   * マウント後・検証前に実行する命令的アクション（任意）。
   * 「描画→Xをクリック→検証」を表現できる。常に await すること。
   */
  act?: (ctx: ActContext) => void | Promise<void>;
}

export interface ActContext {
  /** ユニットがマウントされた root 要素。 */
  root: HTMLElement;
  /** root 内のセレクタ要素をクリック。無ければ throw。 */
  click: (selector: string) => void | Promise<void>;
  /** input にタイプ。無ければ throw。 */
  type: (selector: string, text: string) => void | Promise<void>;
  /** n ミリ秒待つ（遷移/非同期 state の安定待ち）。 */
  wait: (ms: number) => Promise<void>;
}

/* -------------------------------------------------------------------------- */
/* Invariant                                                                  */
/* -------------------------------------------------------------------------- */

/** invariant 述語が見るもの: マウント済み DOM ＋ fixture の props。 */
export interface InvariantContext<P = unknown> {
  root: HTMLElement;
  props: P;
  fixture: Fixture<P>;
  /** 便利: DOM 契約（`data-verify-*`）をマップで読む。 */
  contract: Record<string, string>;
}

/**
 * Invariant はマウント済みユニットに対する名前付き述語。
 * `true`（成立）、`false`（違反）、または string（違反＋人間可読な説明）を返す。
 */
export interface Invariant<P = unknown> {
  id: string;
  description: string;
  check: (ctx: InvariantContext<P>) => boolean | string;
  /** 特定 fixture に限定（既定: 全 fixture）。 */
  onlyFixtures?: string[];
}

/* -------------------------------------------------------------------------- */
/* Verifier（プラグイン）                                                     */
/* -------------------------------------------------------------------------- */

/** 全 Verifier が受け取るコンテキスト。 */
export interface VerifierContext {
  unit: VerifiableUnit<unknown>;
  fixture: Fixture<unknown>;
  root: HTMLElement;
  contract: Record<string, string>;
}

/**
 * Verifier はプラグイン式のチェック。マウント済みユニットを検査し Check を返す。
 * コンポーネントから独立しているため、新種（a11y, perf, visual）をコンポーネント
 * 無改変で足せる。
 */
export interface Verifier {
  id: string;
  description: string;
  run: (ctx: VerifierContext) => Check[] | Promise<Check[]>;
}

/* -------------------------------------------------------------------------- */
/* VerifiableUnit                                                             */
/* -------------------------------------------------------------------------- */

/**
 * VerifiableUnit はモジュール性の単位。単一コンポーネントでも feature スライスでもよい。
 */
export interface VerifiableUnit<P = unknown> {
  id: string;
  title: string;
  description: string;
  /** leaf は "component"、自前 state を持つスライスは "feature"。 */
  kind: 'component' | 'feature';
  /** 与えられた fixture でユニットを孤立レンダリングする。 */
  render: (props: P) => ReactElement;
  /** props 形状を検証する Zod スキーマ。 */
  propsSchema?: ZodTypeAny;
  fixtures: Fixture<P>[];
  invariants: Invariant<P>[];
  /** 実行する verifier ID。省略で全登録 verifier。 */
  verifiers?: string[];
}

/* -------------------------------------------------------------------------- */
/* エージェントハンドル: window.__verify                                      */
/* -------------------------------------------------------------------------- */

export interface VerifyManifestEntry {
  unitId: string;
  title: string;
  kind: 'component' | 'feature';
  fixtures: Array<{ id: string; description: string; probe: boolean }>;
  verifiers: string[];
  invariants: Array<{ id: string; description: string }>;
  /** 孤立マウントへのディープリンク。 */
  route: (fixtureId: string) => string;
}

/**
 * エージェント向けハンドル。`window.__verify` で公開。AI エージェント（や Playwright）は
 * manifest() で全ユニット×fixture を発見し、孤立ルートへ移動し、current()/runAll() で
 * 構造化結果を得られる。
 */
export interface VerifyHandle {
  manifest: () => VerifyManifestEntry[];
  /** 現在マウント中のユニット/fixture の結果（無ければ null）。 */
  current: () => VerifyResult | null;
  /** 全ユニット×fixture を実行してマトリクスを返す。 */
  runAll: () => Promise<VerifyResult[]>;
  /** verify プロトコルのバージョン。 */
  version: string;
}

declare global {
  interface Window {
    __verify?: VerifyHandle;
  }
}
