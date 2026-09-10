/**
 * 「勝手に回っているもの」の一覧。
 *
 * なぜ要るか:
 * このリポジトリには、人が起動しなくても動くものが増え続けている
 * （CI・E2E・セキュリティ監査・依存更新・自動バグ修正）。どれも単体では
 * 見えているが、**全体で何個あって、いつ動いて、いくらかかるのか**を
 * 一覧できる場所が無かった。増やすのは簡単で、把握は難しい。
 *
 * 腐らせないために:
 * この配列は手で書くが、`scripts/check-automation-inventory.mjs` が
 * `.github/workflows/*.yml` と `.github/dependabot.yml` を実際に読んで、
 * **一覧に載っていない自動起動があれば CI を落とす**。
 * ワークフローを足したらここにも足すことになる。
 */

/** 費用の種類。「何を消費するか」が違うと、止めたときに効く場所も違う。 */
export type CostKind =
  /** GitHub Actions の実行時間。public リポジトリなので現在は無制限 */
  | 'actions'
  /** Anthropic API のトークン。月額上限つき（台帳 Issue で管理） */
  | 'tokens'
  /** 費用ゼロ（GitHub の機能だけで完結） */
  | 'none';

export interface Automation {
  id: string;
  /** 画面に出す名前 */
  name: string;
  /** 何をするか。1 行で */
  purpose: string;
  /** 人が起動しなくても動く条件 */
  triggers: string[];
  /** 定期実行がある場合の JST 表記。無ければ null */
  schedule: string | null;
  costKind: CostKind;
  /** 実測に基づく 1 回あたりの目安 */
  costPerRun: string;
  /** 止め方（この文字列がそのまま運用手順になる） */
  killSwitch: string;
  /** 定義ファイル。GitHub 上で開けるパス */
  definedIn: string;
  /** 補足があれば */
  note?: string;
}

/**
 * 費用の数字は 2026-09 の実測。
 * Actions は 351 run のジョブ実時間をジョブ単位で分に切り上げて集計したもの（Issue #551）。
 * トークンは台帳 Issue `[auto-fix] 予算台帳と稼働状況` の実行履歴。
 */
export const AUTOMATIONS: readonly Automation[] = [
  {
    id: 'auto-fix',
    name: '自動バグ修正ループ',
    purpose: 'バグを見つけて直し、ガードレールを通してから自動でマージする',
    triggers: [
      'main で CI / E2E / Security が失敗したとき',
      'Issue に auto-fix ラベルが付いたとき',
      '週次の巡回',
    ],
    schedule: '毎週月曜 05:25',
    costKind: 'tokens',
    costPerRun: '約 ¥90〜100（Claude Sonnet 5・20〜30 ターン）',
    killSwitch: 'リポジトリ変数 AUTO_FIX_ENABLED を消す',
    definedIn: '.github/workflows/auto-fix.yml',
    note: '月額上限は AUTO_FIX_BUDGET_JPY（既定 ¥500）。上限に達すると自動で止まる',
  },
  {
    id: 'auto-merge-deps',
    name: '依存更新の自動マージ',
    purpose: 'dependabot のグループ PR を、CI が全部緑なら自動でマージする',
    triggers: [],
    schedule: '毎日 06:40',
    costKind: 'none',
    costPerRun: '¥0（AI を呼ばない）',
    killSwitch: 'リポジトリ変数 AUTO_FIX_ENABLED を消す',
    definedIn: '.github/workflows/auto-merge-deps.yml',
    note: '単独 PR（major 昇格・security update）は対象外で人が見る',
  },
  {
    id: 'security-audit',
    name: 'セキュリティ全体監査',
    purpose: 'リポジトリ全体を AI が監査し、重大な指摘があれば Issue を立てる',
    triggers: [],
    schedule: '毎月 2 日・16 日 03:17',
    costKind: 'tokens',
    costPerRun: '未計測（差分ではなく全体を読むため auto-fix より高い見込み）',
    killSwitch: 'security.yml の schedule を消す',
    definedIn: '.github/workflows/security.yml',
    note: '指摘がゼロなら Issue を立てない（ノイズを起票しない）',
  },
  {
    id: 'e2e-weekly',
    name: 'E2E フル回帰',
    purpose: '使い捨て Supabase に対して E2E を通しで流す',
    triggers: ['main への push'],
    schedule: '毎週月曜 09:00',
    costKind: 'actions',
    costPerRun: '約 8 分',
    killSwitch: 'e2e.yml の schedule を消す',
    definedIn: '.github/workflows/e2e.yml',
    note: 'PR では「開いたとき / run-e2e ラベル」だけ走る（2026-09 に毎 push から変更）',
  },
  {
    id: 'dependabot',
    name: 'dependabot',
    purpose: '依存ライブラリと GitHub Actions の更新 PR を自動で立てる',
    triggers: ['脆弱性 advisory が出たとき（間隔に関わらず即時）'],
    schedule: '毎月 1 日 09:00',
    costKind: 'none',
    costPerRun: '¥0（PR 作成のみ。CI 費用は auto-merge-deps 側で計上）',
    killSwitch: '.github/dependabot.yml を消す',
    definedIn: '.github/dependabot.yml',
  },
  {
    id: 'ci',
    name: 'CI（静的検査とテスト）',
    purpose: 'lint / typecheck / dep-cruise / knip / check:as / test を回す',
    triggers: ['PR を開いた・更新したとき', 'main への push'],
    schedule: null,
    costKind: 'actions',
    costPerRun: '約 7 分',
    killSwitch: '止めない（これが品質の土台）',
    definedIn: '.github/workflows/ci.yml',
  },
  {
    id: 'security-pr',
    name: 'セキュリティの決定的ゲート',
    purpose: 'RLS 検査 / 依存監査 / secret スキャン / SAST を回す',
    triggers: ['PR を開いた・更新したとき', 'main への push'],
    schedule: null,
    costKind: 'actions',
    costPerRun: '約 4 分',
    killSwitch: '止めない（他人の日記を預かる以上、外せない）',
    definedIn: '.github/workflows/security.yml',
  },
] as const;

/** 定期実行があるものだけ。「放っておいても動くもの」を数えるのに使う。 */
export function scheduledAutomations(list: readonly Automation[] = AUTOMATIONS): Automation[] {
  return list.filter((a) => a.schedule !== null);
}

/** お金（トークン）を使うものだけ。上限管理の対象。 */
export function tokenSpendingAutomations(list: readonly Automation[] = AUTOMATIONS): Automation[] {
  return list.filter((a) => a.costKind === 'tokens');
}
