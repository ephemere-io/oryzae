/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    // === reach: features/shared で端末を判定しない ===
    // shared は「端末非依存」の層。UI を持つことは許すが、その中で端末を分岐したら
    // 端末で出し分ける場所が DeviceView 以外にも増え、reach 軸が骨抜きになる（#490）。
    // 防ぎたいのは「UI があること」ではなく「shared の中で端末が分岐すること」なので、
    // 判定の入口（lib/use-device）と分岐プリミティブ（components/device-view）を禁じる。
    {
      name: 'shared-no-device-detection',
      comment:
        'features/shared must not detect the device (lib/use-device) or branch on it (components/device-view)',
      severity: 'error',
      from: { path: '^src/features/shared/' },
      to: { path: '^src/(lib/use-device|components/device-view)' },
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

    // === app/ は API を直接叩かない（seam を page に漏らさない）===
    // page/layout が fetch を持つと、端末をまたぐ共有ロジックの置き場が app に流れ、
    // features/shared が空洞化する（#490）。データは必ず features/shared の hook 経由。
    {
      name: 'app-no-api-client',
      comment: 'app/ (Route Handler 除く) から lib/api の実装を import してはならない',
      severity: 'error',
      from: { path: '^src/app/', pathNot: '^src/app/api/' },
      to: { path: '^src/lib/api\\.ts$', dependencyTypesNot: ['type-only'] },
    },

    // === app/ は端末固有 hook を import しない（seam 漏れの防止）===
    // DeviceView は描画を分岐するが hook は分岐しない。page が features/pc/**/hooks/ を
    // 呼ぶと、その PC 専用ロジックは SP 端末でも実行される。
    {
      name: 'app-no-reach-hooks',
      comment: 'app/ は features/{pc,sp} の hooks を import してはならない（components のみ可）',
      severity: 'error',
      from: { path: '^src/app/' },
      to: { path: '^src/features/(pc|sp)/[^/]+/hooks/' },
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
  required: [
    // === seam を強制: 保護ルートの page は必ず DeviceView 経由で出し分ける ===
    // DeviceView を使わない page を足すと落ちる。PC を SP シェルに描画して崩す事故を
    // 構造的に防ぐ（SP 変種が無ければ DeviceView が安全な「未対応」表示にフォールバック）。
    {
      name: 'protected-pages-use-device-view',
      comment: '保護ルートの page.tsx は components/device-view を必ず経由する（端末 seam の強制）',
      severity: 'error',
      module: { path: '^src/app/\\(protected\\)/.*page\\.tsx$' },
      to: { path: '^src/components/device-view' },
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
