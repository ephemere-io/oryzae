/**
 * dom-contract verifier — マウント済みユニットが実際に `data-verify-*` 契約を出しているか、
 * 契約がユニットを自己同定しているかをチェックする。
 *
 * DOM は表面。契約を出さないユニットはエージェントが信頼して読むものが無い → warn ではなく FAIL。
 */

import { readAllContracts } from '../core/contract';
import { registerVerifier } from '../core/registry';
import type { Check, Verifier } from '../core/types';

export const domContractVerifier: Verifier = registerVerifier({
  id: 'dom-contract',
  description: 'Checks the unit emits a machine-readable data-verify-* contract.',
  run({ unit, fixture, root, contract }) {
    const checks: Check[] = [];

    if (Object.keys(contract).length === 0) {
      return [
        {
          verifier: 'dom-contract',
          status: 'fail',
          label: 'No DOM contract emitted',
          detail:
            'No element with data-verify-* attributes found. The surface is not machine-readable.',
        },
      ];
    }

    checks.push({
      verifier: 'dom-contract',
      status: fixture.probe ? 'probe' : 'ok',
      label: `Contract present (${Object.keys(contract).length} attrs)`,
      evidence: contract,
    });

    if (contract.unit) {
      checks.push({
        verifier: 'dom-contract',
        status: 'ok',
        label: `Contract self-identifies as "${contract.unit}"`,
      });
    } else {
      checks.push({
        verifier: 'dom-contract',
        status: 'warn',
        label: 'Contract missing data-verify-unit',
        detail: "Agents can't confirm they're observing the right component.",
      });
    }

    const all = readAllContracts(root);
    if (unit.kind === 'component' && all.length > 1) {
      checks.push({
        verifier: 'dom-contract',
        status: 'warn',
        label: `Multiple contract nodes found (${all.length})`,
        detail: 'A component-kind unit emitted more than one data-verify-unit node.',
      });
    }

    return checks;
  },
});
