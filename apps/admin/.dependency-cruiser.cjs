/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    // === Feature isolation ===
    {
      name: 'feature-isolation',
      comment: 'Features must not import from other features',
      severity: 'error',
      from: { path: '^src/features/([^/]+)' },
      to: { path: '^src/features/([^/]+)', pathNot: '^src/features/$1' },
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
