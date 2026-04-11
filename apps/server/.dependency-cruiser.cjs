/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    // === Bounded Context isolation ===
    {
      name: 'entry-context-isolation',
      comment: 'entry context must not import from other contexts (except shared)',
      severity: 'error',
      from: { path: '^src/contexts/entry' },
      to: { path: '^src/contexts/', pathNot: ['^src/contexts/entry', '^src/contexts/shared'] },
    },
    {
      name: 'question-context-isolation',
      comment:
        'question context may import entry domain (gateway IFs) and entry infrastructure (DI wiring in presentation only)',
      severity: 'error',
      from: { path: '^src/contexts/question/(domain|application|infrastructure)' },
      to: {
        path: '^src/contexts/entry',
        pathNot: '^src/contexts/entry/domain',
      },
    },
    {
      name: 'shared-context-independence',
      comment: 'shared context must not import from any specific context',
      severity: 'error',
      from: { path: '^src/contexts/shared' },
      to: { path: '^src/contexts/', pathNot: '^src/contexts/shared' },
    },

    // === DDD layer rules for entry ===
    {
      name: 'entry-domain-isolation',
      comment: 'entry domain must not depend on other layers',
      severity: 'error',
      from: { path: '^src/contexts/entry/domain' },
      to: { path: '^src/contexts/entry/(application|infrastructure|presentation)' },
    },
    {
      name: 'entry-application-no-infra',
      severity: 'error',
      from: { path: '^src/contexts/entry/application' },
      to: { path: '^src/contexts/entry/infrastructure' },
    },
    {
      name: 'entry-application-no-presentation',
      severity: 'error',
      from: { path: '^src/contexts/entry/application' },
      to: { path: '^src/contexts/entry/presentation' },
    },
    {
      name: 'entry-infra-no-application',
      severity: 'error',
      from: { path: '^src/contexts/entry/infrastructure' },
      to: { path: '^src/contexts/entry/application' },
    },
    {
      name: 'entry-infra-no-presentation',
      severity: 'error',
      from: { path: '^src/contexts/entry/infrastructure' },
      to: { path: '^src/contexts/entry/presentation' },
    },

    // === DDD layer rules for question ===
    {
      name: 'question-domain-isolation',
      comment: 'question domain must not depend on other layers',
      severity: 'error',
      from: { path: '^src/contexts/question/domain' },
      to: { path: '^src/contexts/question/(application|infrastructure|presentation)' },
    },
    {
      name: 'question-application-no-infra',
      severity: 'error',
      from: { path: '^src/contexts/question/application' },
      to: { path: '^src/contexts/question/infrastructure' },
    },
    {
      name: 'question-application-no-presentation',
      severity: 'error',
      from: { path: '^src/contexts/question/application' },
      to: { path: '^src/contexts/question/presentation' },
    },
    {
      name: 'question-infra-no-application',
      severity: 'error',
      from: { path: '^src/contexts/question/infrastructure' },
      to: { path: '^src/contexts/question/application' },
    },
    {
      name: 'question-infra-no-presentation',
      severity: 'error',
      from: { path: '^src/contexts/question/infrastructure' },
      to: { path: '^src/contexts/question/presentation' },
    },

    // === Board context isolation ===
    {
      name: 'board-context-isolation',
      comment:
        'board context may import entry domain (gateway IFs for cross-context reads)',
      severity: 'error',
      from: { path: '^src/contexts/board/(domain|application|infrastructure)' },
      to: {
        path: '^src/contexts/',
        pathNot: ['^src/contexts/board', '^src/contexts/shared', '^src/contexts/entry/domain'],
      },
    },

    // === DDD layer rules for board ===
    {
      name: 'board-domain-isolation',
      comment: 'board domain must not depend on other layers',
      severity: 'error',
      from: { path: '^src/contexts/board/domain' },
      to: { path: '^src/contexts/board/(application|infrastructure|presentation)' },
    },
    {
      name: 'board-application-no-infra',
      severity: 'error',
      from: { path: '^src/contexts/board/application' },
      to: { path: '^src/contexts/board/infrastructure' },
    },
    {
      name: 'board-application-no-presentation',
      severity: 'error',
      from: { path: '^src/contexts/board/application' },
      to: { path: '^src/contexts/board/presentation' },
    },
    {
      name: 'board-infra-no-application',
      severity: 'error',
      from: { path: '^src/contexts/board/infrastructure' },
      to: { path: '^src/contexts/board/application' },
    },
    {
      name: 'board-infra-no-presentation',
      severity: 'error',
      from: { path: '^src/contexts/board/infrastructure' },
      to: { path: '^src/contexts/board/presentation' },
    },

    // === Shared domain isolation ===
    {
      name: 'shared-domain-isolation',
      severity: 'error',
      from: { path: '^src/contexts/shared/domain' },
      to: { path: '^src/contexts/shared/(infrastructure|presentation|application)' },
    },

    // === Domain must not import @oryzae/shared ===
    {
      name: 'domain-no-shared-package',
      comment: 'domain must not import @oryzae/shared (it depends on zod, domain must be pure)',
      severity: 'error',
      from: { path: '^src/contexts/[^/]+/domain' },
      to: { path: '@oryzae/shared' },
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
