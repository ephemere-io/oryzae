/**
 * invariant verifier — ユニットが宣言した invariant 述語をマウント済み DOM に対して回す。
 * invariant は実行時アサーション。design-by-contract の片割れ。
 */

import { registerVerifier } from '../core/registry';
import type { Check, Verifier } from '../core/types';

export const invariantVerifier: Verifier = registerVerifier({
  id: 'invariants',
  description: "Runs the unit's declared invariant predicates against the DOM.",
  run({ unit, fixture, root, contract }) {
    const checks: Check[] = [];
    for (const inv of unit.invariants) {
      if (inv.onlyFixtures && !inv.onlyFixtures.includes(fixture.id)) continue;
      let outcome: boolean | string;
      try {
        outcome = inv.check({ root, props: fixture.props, fixture, contract });
      } catch (err) {
        checks.push({
          verifier: 'invariants',
          status: 'fail',
          label: inv.description,
          detail: `Invariant "${inv.id}" threw: ${String(err)}`,
        });
        continue;
      }
      if (outcome === true) {
        checks.push({
          verifier: 'invariants',
          status: fixture.probe ? 'probe' : 'ok',
          label: inv.description,
        });
      } else {
        checks.push({
          verifier: 'invariants',
          status: 'fail',
          label: inv.description,
          detail: typeof outcome === 'string' ? outcome : `Invariant "${inv.id}" returned false.`,
        });
      }
    }
    if (checks.length === 0) {
      checks.push({
        verifier: 'invariants',
        status: 'warn',
        label: 'No invariants ran',
        detail:
          'Unit declares no invariants for this fixture. A surface with zero invariants is unverified.',
      });
    }
    return checks;
  },
});
