/**
 * HelpHint の検証スペック。
 *
 * 見張るのは「**触れなければ邪魔をしない／触れば読める**」こと。常に出していると設定の
 * 一覧が読めなくなり、ホバーだけにするとキーボードで辿る人に届かない。
 */
import { registerUnit } from '@oryzae/verify';
import { HelpHint } from './help-hint';

interface Props {
  text: string;
}

registerUnit<Props>({
  id: 'HelpHint',
  title: 'HelpHint',
  description: '設定の名前の隣に置く「？」。触れると意味が出る。',
  kind: 'component',
  render: (props) => (
    <div className="flex w-[19rem] justify-end p-10">
      <HelpHint subject="時間内包について" text={props.text} />
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
      description: '触れた — 説明が出る',
      props: { text: '書く速さが字の大きさになる。ゆっくり打つほど大きくなる。' },
      act: async ({ root, wait }) => {
        const btn = root.querySelector<HTMLButtonElement>('[data-verify-unit="HelpHint"]');
        btn?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        btn?.focus();
        await wait(16);
      },
    },
    {
      id: 'long-text',
      probe: true,
      description: 'Probe: 長い説明 — 1行に押し込めず折り返す',
      props: {
        text: 'マイクで打鍵音を拾って、キーを打つ瞬間だけ大きくして返す。ヘッドホンを着けて使う。マイクの使用を許可していないと何も起きない。',
      },
      act: async ({ root, wait }) => {
        root.querySelector<HTMLButtonElement>('[data-verify-unit="HelpHint"]')?.focus();
        await wait(16);
      },
    },
  ],
  invariants: [
    {
      id: 'quiet-until-touched',
      description: '触れていないあいだ、説明は画面に出ていない',
      check: ({ root, contract }) => {
        const tip = root.querySelector('[role="tooltip"]');
        if (contract.open === 'true') return true;
        return tip === null || '触れていないのに説明が出ている';
      },
    },
    {
      id: 'keyboard-reaches-it',
      // hover しか無いと、キーボードで辿る人には届かない。
      description: 'キーボードでも開く（focus で出る）',
      onlyFixtures: ['hovered', 'long-text'],
      check: ({ root, contract }) => {
        if (contract.open !== 'true') return 'focus しても開いていない';
        const tip = root.querySelector('[role="tooltip"]');
        return tip !== null || '開いているのに説明が無い';
      },
    },
    {
      id: 'explanation-is-announced',
      // 読み上げにも説明が届く。見えているだけでは足りない。
      description: '開いているとき、説明がボタンに結びついている',
      onlyFixtures: ['hovered', 'long-text'],
      check: ({ root }) => {
        const btn = root.querySelector('[data-verify-unit="HelpHint"]');
        const described = btn?.getAttribute('aria-describedby');
        if (!described) return 'aria-describedby が無い';
        return (
          root.querySelector(`#${CSS.escape(described)}`) !== null ||
          'aria-describedby の指す先が無い'
        );
      },
    },
    {
      id: 'does-not-swallow-clicks',
      // 説明は読むだけのもの。触れるものが増えると、設定の面に操作が2種類生まれる。
      description: '説明そのものは操作を受け取らない',
      onlyFixtures: ['hovered', 'long-text'],
      check: ({ root }) => {
        const tip = root.querySelector('[role="tooltip"]');
        if (!tip) return '説明が無い';
        return tip.className.includes('pointer-events-none') || '説明がクリックを受け取ってしまう';
      },
    },
  ],
});
