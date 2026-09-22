/**
 * HelpFirstSteps の検証スペック。
 *
 * 見張るのは「三歩が順に並び、それぞれ押せる」こと、三歩目に最初の手紙が届く条件
 * （文字数）が添えてあること。
 */

import { registerUnit } from '@oryzae/verify';
import jaMessages from '@/i18n/messages/ja.json';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { HelpFirstSteps } from './help-first-steps';

type Props = Record<string, never>;

registerUnit<Props>({
  id: 'HelpFirstSteps',
  title: 'HelpFirstSteps',
  description: '「まず試してみよう」— 問いを立てる → 書く → 漬けて待つ の三歩',
  kind: 'component',
  render: () =>
    withVerifyProviders(
      <div className="w-[336px] p-3" style={{ background: 'var(--bg)' }}>
        <HelpFirstSteps onOpenHref={() => {}} />
      </div>,
    ),
  fixtures: [{ id: 'default', probe: true, description: 'Probe: 三歩がこの順で並ぶ', props: {} }],
  invariants: [
    {
      id: 'three-steps-in-order',
      description: '問い → 書く → 漬ける の順に 3 つ',
      check: ({ root, contract }) => {
        const items = [...root.querySelectorAll('li')].map((li) => li.textContent ?? '');
        if (items.length !== 3 || contract.stepCount !== '3') return `${items.length} 歩`;
        const s = jaMessages.help.steps;
        const ok =
          items[0]?.includes(s.question.title) &&
          items[1]?.includes(s.write.title) &&
          items[2]?.includes(s.pickle.title);
        return ok || `順が違う: ${items.map((x) => x.slice(0, 8)).join(' / ')}`;
      },
    },
    {
      id: 'each-step-is-pressable',
      description: 'それぞれの歩が押せる（読む物ではなく辿る物）',
      check: ({ root }) => root.querySelectorAll('li button').length === 3 || '押せない歩がある',
    },
    {
      id: 'pickle-step-tells-the-condition',
      description: '三歩目に最初の手紙が届く条件（文字数）が添えてある',
      check: ({ root }) => {
        const third = root.querySelectorAll('li')[2]?.textContent ?? '';
        return /\d/.test(third) || '三歩目に数字（文字数）が無い';
      },
    },
  ],
});
