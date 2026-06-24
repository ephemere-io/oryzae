/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    // === Feature isolation (transitional: flat features, pre reach-migration) ===
    // apps/client は features を「ドメイン × reach(shared/pc/sp)」で薄切りする
    // (docs/client-architecture-guide.md)。reach 化が完了するまでは、まだ移行して
    // いないフラットな features/{domain} が残る。その相互依存はこれまで通り禁止し続け、
    // ただし features/shared への import だけは許可する（共有層への押し上げのため）。
    {
      name: 'feature-isolation-flat',
      comment:
        'Legacy flat features must not import other flat features (features/shared is allowed)',
      severity: 'error',
      from: { path: '^src/features/([^/]+)', pathNot: '^src/features/(pc|sp|shared)/' },
      to: { path: '^src/features/', pathNot: ['^src/features/$1', '^src/features/shared/'] },
    },

    // === reach: pc/sp スライスは「自ドメイン」と「features/shared」のみ import 可 ===
    // これ1つで pc ⇎ sp（端末跨ぎ）と、pc/sp 内のドメイン跨ぎの両方を禁止する。
    {
      name: 'reach-slice-isolation',
      comment: 'A pc/sp slice may import only its own domain and features/shared/*',
      severity: 'error',
      from: { path: '^src/features/(pc|sp)/([^/]+)' },
      to: { path: '^src/features/', pathNot: ['^src/features/$1/$2', '^src/features/shared/'] },
    },

    // === reach: features/shared は端末固有 features(pc/sp) を import してはならない ===
    {
      name: 'reach-shared-purity',
      comment: 'features/shared (device-agnostic) must not import device-specific pc/sp features',
      severity: 'error',
      from: { path: '^src/features/shared/' },
      to: { path: '^src/features/(pc|sp)/' },
    },

    // === UI components independence ===
    {
      name: 'ui-components-independence',
      comment: 'Shared UI components must not depend on features or app',
      severity: 'error',
      from: { path: '^src/components/' },
      to: { path: '^src/(features|app)/' },
    },

    // === lib independence ===
    {
      name: 'lib-independence',
      comment: 'lib/ is cross-cutting infra, must not depend on features/app/components',
      severity: 'error',
      from: { path: '^src/lib/' },
      to: { path: '^src/(features|app|components)/' },
    },

    // === No circular dependencies ===
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: './tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
  },
};
