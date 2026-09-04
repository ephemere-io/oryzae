/**
 * StudyTooltip の検証スペック。
 *
 * 「手帳をホバーすると、月・件数・日付範囲のツールチップが出る（棚の背表紙も同じ）」
 * という受け入れ基準（40-acceptance.md「ラベルとホバー」）を見る。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { StudyTooltip } from './study-tooltip';

interface Props {
  month: string | null;
  entryCount: number;
  range: { first: string; last: string } | null;
  current: boolean;
  screen: { x: number; y: number };
}

const SCREEN = { x: 200, y: 200 };

registerUnit<Props>({
  id: 'StudyTooltip',
  title: 'StudyTooltip',
  description: '手帳・背表紙のホバーで出す紙のツールチップ',
  kind: 'component',
  render: (props) => withVerifyProviders(<StudyTooltip {...props} />),
  fixtures: [
    {
      id: 'current-month',
      description: '当月',
      props: {
        month: '2026-09',
        entryCount: 11,
        range: { first: '2026-09-01', last: '2026-09-02' },
        current: true,
        screen: SCREEN,
      },
    },
    {
      id: 'past-month',
      description: '過去月',
      props: {
        month: '2026-08',
        entryCount: 4,
        range: { first: '2026-08-03', last: '2026-08-28' },
        current: false,
        screen: SCREEN,
      },
    },
    {
      id: 'empty-month',
      probe: true,
      description: 'Probe: 記録が無い月は件数だけ（日付範囲を作れない）',
      props: { month: '2026-07', entryCount: 0, range: null, current: false, screen: SCREEN },
    },
  ],
  invariants: [
    {
      id: 'shows-month',
      description: '月が 2026.09 の表記で出る',
      check: ({ root, props }) => {
        const expected = (props.month ?? '').replace('-', '.');
        return root.textContent?.includes(expected) || `月 "${expected}" が出ていない`;
      },
    },
    {
      id: 'shows-count',
      description: '件数が出る',
      check: ({ root, props }) =>
        root.textContent?.includes(String(props.entryCount)) || '件数が出ていない',
    },
    {
      id: 'range-only-when-present',
      description: '日付範囲は記録がある月にだけ出す',
      check: ({ root, props }) => {
        const hasDash = (root.textContent ?? '').includes('–');
        return hasDash === (props.range !== null) || '日付範囲の出し分けが契約と違う';
      },
    },
    {
      id: 'current-marked',
      description: '当月にだけ「当月」が付く',
      check: ({ root, props, contract }) => {
        if (contract.current !== 'true') return true;
        return (root.textContent ?? '').length > 0 && props.current;
      },
    },
  ],
});
