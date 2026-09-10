/**
 * StudyHintTooltip の検証スペック。
 *
 * 名前しか言わないラベルの代わりに中身を告げる 1 行なので、守るのは
 * 「**訳された言葉が出る**」ことと「指やカーソルを奪わない」こと。
 * 数を差し込む鍵（板の内訳）は、鍵がそのまま見えていないかで一緒に守られる。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { StudyHintTooltip } from './study-hint-tooltip';

interface Props {
  textKey: string;
  values?: Record<string, number>;
  screen: { x: number; y: number };
}

const AT = { x: 160, y: 90 };

registerUnit<Props>({
  id: 'StudyHintTooltip',
  title: 'StudyHintTooltip',
  description: '的に触れたとき、そこに何があるかを一言で出す',
  kind: 'component',
  render: (props) =>
    withVerifyProviders(
      <div style={{ position: 'relative', width: '320px', height: '160px' }}>
        <StudyHintTooltip {...props} />
      </div>,
    ),
  fixtures: [
    { id: 'pen', description: '鉛筆に触れている', props: { textKey: 'hint_pen', screen: AT } },
    {
      id: 'board',
      description: '板に触れている（内訳を差し込む）',
      props: { textKey: 'hint_board_both', values: { photos: 3, snippets: 12 }, screen: AT },
    },
    {
      id: 'jar-letter',
      description: '瓶に触れている（未読の手紙がある）',
      props: { textKey: 'hint_jar_letter', screen: AT },
    },
    {
      id: 'far-right',
      probe: true,
      description: 'Probe: 端に寄っても中央揃えの基準がずれない',
      props: { textKey: 'hint_pen', screen: { x: 300, y: 40 } },
    },
  ],
  invariants: [
    {
      id: 'shows-translated-text',
      description: '訳された言葉を出す（鍵がそのまま見えない）',
      check: ({ root, props }) => {
        const text = (root.textContent ?? '').trim();
        if (text.length === 0) return '何も出ていない';
        return text !== props.textKey || `i18n の鍵がそのまま出ている: ${text}`;
      },
    },
    {
      id: 'does-not-eat-the-pointer',
      description: '指やカーソルを奪わない（下の 3D を触り続けられる）',
      check: ({ root }) => {
        const tip = root.querySelector('[data-verify-unit="StudyHintTooltip"]');
        const className = tip?.className ?? '';
        return (
          className.includes('pointer-events-none') ||
          'pointer-events-none が無い（ツールチップが当たりを奪う）'
        );
      },
    },
    {
      id: 'sits-above-the-target',
      description: '触れている物の上に出す（物そのものを隠さない）',
      check: ({ root }) => {
        const tip = root.querySelector('[data-verify-unit="StudyHintTooltip"]');
        if (!(tip instanceof HTMLElement)) return 'ツールチップが無い';
        return (
          tip.style.transform.includes('-100%') ||
          `上へ逃がしていない: transform=${tip.style.transform}`
        );
      },
    },
  ],
});
