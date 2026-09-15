/**
 * HelpHint の検証スペック。
 *
 * 見張るのは「**触れなければ邪魔をしない／触れば読める**」こと。常に出していると設定の
 * 一覧が読めなくなり、ホバーだけにするとキーボードで辿る人に届かない。
 *
 * もう1つは「**載っている面の縁で切れない**」こと。説明は body 直下に出る（portal）ので、
 * 探すときは root の中ではなく、「？」の aria-describedby から辿る。
 */
import { registerUnit } from '@oryzae/verify';
import { HelpHint } from './help-hint';

interface Props {
  text: string;
}

const HINT = '[data-verify-unit="HelpHint"]';

/** 開いている説明。body 直下にあるので、「？」の aria-describedby から辿る。 */
function tooltipOf(root: HTMLElement): HTMLElement | null {
  const id = root.querySelector(HINT)?.getAttribute('aria-describedby');
  return id ? root.ownerDocument.getElementById(id) : null;
}

registerUnit<Props>({
  id: 'HelpHint',
  title: 'HelpHint',
  description: '設定の名前の隣に置く「？」。触れると意味が出る。',
  kind: 'component',
  render: (props) => (
    // 設定パネルと同じ形にする: 幅 19rem のスクロールする面で、「？」は名前のすぐ後ろ。
    // 以前はこの面の左の縁で説明が切れていた。
    <div
      role="dialog"
      aria-label="設定"
      className="w-[19rem] overflow-y-auto rounded-lg border px-5 py-4"
      style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg)' }}
    >
      <div className="flex h-9 items-center justify-between gap-4">
        <span className="flex items-center gap-1.5 text-[13px] text-[var(--fg)]">
          時間内包
          <HelpHint subject="時間内包について" text={props.text} />
        </span>
      </div>
    </div>
  ),
  fixtures: [
    {
      id: 'idle',
      probe: true,
      description: '触れていない — 説明は出ていない',
      props: { text: '書く速さが字の大きさになる。ゆっくり打つほど大きくなる。' },
    },
    {
      id: 'hovered',
      description: '触れた — 説明が「？」の右に出る',
      props: { text: '書く速さが字の大きさになる。ゆっくり打つほど大きくなる。' },
      act: async ({ root, wait }) => {
        const btn = root.querySelector<HTMLButtonElement>(HINT);
        btn?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        btn?.focus();
        await wait(16);
      },
    },
    {
      id: 'long-text',
      probe: true,
      description: 'Probe: 長い説明 — 1行に押し込めず折り返し、面の縁で切れない',
      props: {
        text: 'マイクで打鍵音を拾って、キーを打つ瞬間だけ大きくして返す。ヘッドホンを着けて使う。マイクの使用を許可していないと何も起きない。',
      },
      act: async ({ root, wait }) => {
        root.querySelector<HTMLButtonElement>(HINT)?.focus();
        await wait(16);
      },
    },
  ],
  invariants: [
    {
      id: 'quiet-until-touched',
      description: '触れていないあいだ、説明は画面に出ていない',
      check: ({ root, contract }) => {
        if (contract.open === 'true') return true;
        return (
          root.ownerDocument.querySelector('[role="tooltip"]') === null ||
          '触れていないのに説明が出ている'
        );
      },
    },
    {
      id: 'keyboard-reaches-it',
      // hover しか無いと、キーボードで辿る人には届かない。
      description: 'キーボードでも開く（focus で出る）',
      onlyFixtures: ['hovered', 'long-text'],
      check: ({ root, contract }) => {
        if (contract.open !== 'true') return 'focus しても開いていない';
        return tooltipOf(root) !== null || '開いているのに説明が無い';
      },
    },
    {
      id: 'explanation-is-announced',
      // 読み上げにも説明が届く。見えているだけでは足りない。
      description: '開いているとき、説明がボタンに結びついている',
      onlyFixtures: ['hovered', 'long-text'],
      check: ({ root }) => {
        const described = root.querySelector(HINT)?.getAttribute('aria-describedby');
        if (!described) return 'aria-describedby が無い';
        return (
          root.ownerDocument.getElementById(described) !== null || 'aria-describedby の指す先が無い'
        );
      },
    },
    {
      id: 'does-not-swallow-clicks',
      // 説明は読むだけのもの。触れるものが増えると、設定の面に操作が2種類生まれる。
      description: '説明そのものは操作を受け取らない',
      onlyFixtures: ['hovered', 'long-text'],
      check: ({ root }) => {
        const tip = tooltipOf(root);
        if (!tip) return '説明が無い';
        return tip.className.includes('pointer-events-none') || '説明がクリックを受け取ってしまう';
      },
    },
    {
      id: 'escapes-the-surface',
      // 設定パネルはスクロールする面なので、その中に置くと、どちらへ開いても縁で切れる。
      description: '説明は載っている面の外（body 直下）に出る',
      onlyFixtures: ['hovered', 'long-text'],
      check: ({ root }) => {
        const tip = tooltipOf(root);
        if (!tip) return '説明が無い';
        if (root.contains(tip)) return '説明が「？」と同じ面の中にある（面の縁で切れる）';
        return tip.className.includes('fixed') || '説明が窓に対して置かれていない（fixed でない）';
      },
    },
  ],
});
