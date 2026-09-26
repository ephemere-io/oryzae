/**
 * HelpWelcome の検証スペック。
 *
 * 見張るのは「**伝えることが 2 つだけ**」であること（挨拶・案内の在処・始める）と、
 * 面の側を沈めないこと（PC は右端を `--help-width` で止め、SP はシートの上端で止める）。
 */

import { registerUnit } from '@oryzae/verify';
import jaMessages from '@/i18n/messages/ja.json';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { SP_HELP_SHEET_HEIGHT } from '../help-context';
import { HelpWelcome } from './help-welcome';

interface Props {
  guide: 'right' | 'below';
}

const ROOT = '[data-verify-unit="HelpWelcome"]';

registerUnit<Props>({
  id: 'HelpWelcome',
  title: 'HelpWelcome',
  description: '初めての人が最初に見る 1 枚。面以外を沈め、案内の在処と「始めてみよう」だけ',
  kind: 'component',
  render: (props) =>
    withVerifyProviders(
      <div className="relative h-[420px] w-[640px]">
        <HelpWelcome guide={props.guide} onStart={() => {}} />
      </div>,
    ),
  fixtures: [
    { id: 'pc', description: 'PC — 案内は右の面', props: { guide: 'right' } },
    {
      id: 'sp',
      probe: true,
      description: 'Probe: SP — 案内は下のシート。沈みはシートの上端で止まる',
      props: { guide: 'below' },
    },
  ],
  invariants: [
    {
      id: 'says-only-three-things',
      description: '挨拶・案内の在処・始める、の 3 行だけ（説明を足さない）',
      check: ({ root, props }) => {
        const w = jaMessages.help.welcome;
        const text = (root.textContent ?? '').replace(/\s+/g, '');
        const expected = [
          w.title,
          props.guide === 'right' ? w.guide_right : w.guide_below,
          w.start,
        ];
        const missing = expected.filter((s) => !text.includes(s.replace(/\s+/g, '')));
        if (missing.length) return `無い: ${missing.join(' / ')}`;
        // 3 行ぶん（＋矢印 1 文字）より長ければ、何か余計に言っている。
        const budget = expected.join('').replace(/\s+/g, '').length + 1;
        return text.length <= budget || `言葉が多い: ${text.length} > ${budget}`;
      },
    },
    {
      id: 'keeps-the-panel-clear',
      description: '面の側を沈めない（右の面なら --help-width で止め、下のシートなら上端で止める）',
      check: ({ root, props }) => {
        const el = root.querySelector<HTMLElement>(ROOT);
        if (!el) return '沈みが無い';
        return props.guide === 'right'
          ? el.style.right.includes('--help-width') || `right="${el.style.right}"`
          : el.style.bottom === SP_HELP_SHEET_HEIGHT || `bottom="${el.style.bottom}"`;
      },
    },
    {
      id: 'start-is-pressable',
      description: '「始めてみよう」が押せる（沈みそのものも押せる）',
      check: ({ root }) => {
        const buttons = root.querySelectorAll(`${ROOT} button`);
        return buttons.length === 2 || `button が ${buttons.length} 個`;
      },
    },
  ],
});
