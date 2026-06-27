/**
 * schema verifier — fixture の props をユニットの Zod スキーマで検証する。
 * 契約の「静的な形」側。fixture が主張する props と実際にコンポーネントが期待する形の
 * ズレを捕まえる。
 */

import { registerVerifier } from '../core/registry';
import type { Verifier } from '../core/types';

export const schemaVerifier: Verifier = registerVerifier({
  id: 'schema',
  description: "Validates fixture props against the unit's Zod propsSchema.",
  run({ unit, fixture }) {
    if (!unit.propsSchema) {
      return [
        {
          verifier: 'schema',
          status: 'warn',
          label: 'No propsSchema declared',
          detail: 'Unit has no Zod schema — fixtures are unvalidated. Consider declaring one.',
        },
      ];
    }
    const result = unit.propsSchema.safeParse(fixture.props);
    if (result.success) {
      return [
        {
          verifier: 'schema',
          status: fixture.probe ? 'probe' : 'ok',
          label: 'Props match schema',
        },
      ];
    }
    return [
      {
        verifier: 'schema',
        status: 'fail',
        label: 'Props violate schema',
        detail: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
        evidence: result.error.issues,
      },
    ];
  },
});
