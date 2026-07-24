/**
 * runner: ユニット×fixture を（画面外に）マウントし、適用 verifier を全実行し、
 * verdict を計算して構造化 VerifyResult を返す。
 *
 * verdict ルール:
 *  - マウント不能/verifier 0個/setup で throw → BLOCKED
 *  - いずれかの check が "fail" → FAIL
 *  - それ以外 → PASS（warn と probe は落とさない）
 *  - fixture 0個のユニット → SKIP
 *
 * 「迷ったら FAIL」。verifier 内の例外は error を証拠にした "fail" check になる（握り潰さない）。
 */

import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { readContract } from './contract';
import { verifiersFor } from './registry';
import type { ActContext, Check, Fixture, Verdict, VerifiableUnit, VerifyResult } from './types';

export interface RunOptions {
  /** この要素にマウントする（画面外コンテナの代わりに可視マウントを検証できる）。 */
  container?: HTMLElement;
  /** 既にマウント済み: マウントをスキップし container を読んで検証するだけ。 */
  alreadyMounted?: boolean;
  /** 検証後に unmount しない（UnitPage が可視マウントを残すため）。 */
  keepMounted?: boolean;
}

export async function runFixture(
  unit: VerifiableUnit<unknown>,
  fixture: Fixture<unknown>,
  opts: RunOptions = {},
): Promise<VerifyResult> {
  const started = now();
  // fixture 間の隔離: 直前のユニットが書いた localStorage/sessionStorage を持ち越さない。
  // （例: あるユニットが access token を書くと、別ユニットの「未ログイン」probe を汚染する。）
  resetStorage();
  const base = {
    unitId: unit.id,
    fixtureId: fixture.id,
    timestamp: new Date().toISOString(),
  };

  const applicable = verifiersFor(unit);
  if (applicable.length === 0) {
    return {
      ...base,
      verdict: 'BLOCKED',
      checks: [],
      domSnapshot: {},
      durationMs: ms(started),
      blockedReason: `No verifiers registered for unit "${unit.id}".`,
    };
  }

  let container = opts.container ?? null;
  let ownRoot: Root | null = null;
  let ownContainer: HTMLElement | null = null;

  try {
    if (!opts.alreadyMounted) {
      if (!container) {
        ownContainer = document.createElement('div');
        ownContainer.setAttribute('data-verify-sandbox', 'true');
        ownContainer.style.position = 'fixed';
        ownContainer.style.left = '-10000px';
        ownContainer.style.top = '0';
        ownContainer.style.width = '800px';
        document.body.appendChild(ownContainer);
        container = ownContainer;
      }
      ownRoot = createRoot(container);
      const root = ownRoot;
      flushSync(() => {
        root.render(unit.render(fixture.props));
      });
      await tick();
      if (fixture.act) {
        await fixture.act(makeActContext(container));
        await tick();
      }
    }

    if (!container) {
      return {
        ...base,
        verdict: 'BLOCKED',
        checks: [],
        domSnapshot: {},
        durationMs: ms(started),
        blockedReason: 'No container to observe.',
      };
    }

    const contract = readContract(container);
    const checks: Check[] = [];

    for (const v of applicable) {
      try {
        const produced = await v.run({ unit, fixture, root: container, contract });
        checks.push(...produced);
      } catch (err) {
        checks.push({
          verifier: v.id,
          status: 'fail',
          label: `Verifier "${v.id}" threw`,
          detail: String(err),
          evidence: err instanceof Error ? err.stack : err,
        });
      }
    }

    return {
      ...base,
      verdict: verdictOf(checks),
      checks,
      domSnapshot: contract,
      durationMs: ms(started),
    };
  } catch (err) {
    return {
      ...base,
      verdict: 'BLOCKED',
      checks: [],
      domSnapshot: {},
      durationMs: ms(started),
      blockedReason: `Mount failed: ${String(err)}`,
    };
  } finally {
    if (!opts.keepMounted) {
      if (ownRoot) ownRoot.unmount();
      if (ownContainer) ownContainer.remove();
    }
  }
}

export async function runUnit(unit: VerifiableUnit<unknown>): Promise<VerifyResult[]> {
  if (unit.fixtures.length === 0) {
    return [
      {
        unitId: unit.id,
        fixtureId: '(none)',
        verdict: 'SKIP',
        checks: [],
        domSnapshot: {},
        durationMs: 0,
        blockedReason: 'Unit declares no fixtures — nothing to observe.',
        timestamp: new Date().toISOString(),
      },
    ];
  }
  const out: VerifyResult[] = [];
  for (const f of unit.fixtures) {
    out.push(await runFixture(unit, f));
  }
  return out;
}

export function verdictOf(checks: Check[]): Verdict {
  if (checks.some((c) => c.status === 'fail')) return 'FAIL';
  return 'PASS';
}

/* ----------------------------- helpers ----------------------------- */

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function ms(since: number): number {
  return Math.round(now() - since);
}

function tick(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

/** fixture 間の状態リーク防止に Web Storage をクリアする（存在する環境でのみ）。 */
function resetStorage(): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.clear();
    if (typeof sessionStorage !== 'undefined') sessionStorage.clear();
  } catch {
    /* storage 非対応環境では何もしない */
  }
}

export function makeActContext(root: HTMLElement): ActContext {
  return {
    root,
    click(selector) {
      const el = root.querySelector<HTMLElement>(selector);
      if (!el) throw new Error(`act.click: no element matching "${selector}"`);
      el.click();
    },
    type(selector, text) {
      const el = root.querySelector<HTMLInputElement>(selector);
      if (!el) throw new Error(`act.type: no element matching "${selector}"`);
      // React の onChange を発火させるためネイティブ setter 経由で値を設定する。
      const proto = Object.getPrototypeOf(el);
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      setter?.call(el, text);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    },
    wait(msAmount) {
      return new Promise((r) => setTimeout(r, msAmount));
    },
  };
}
