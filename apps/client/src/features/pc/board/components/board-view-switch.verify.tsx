/**
 * BoardViewSwitch の検証スペック。
 *
 * 盤面右上の表示単位切り替え。完全制御（state を持たない）なので、契約↔props 一致と
 * 「2択がどちらの状態でも欠けない」「aria-pressed が viewType とちょうど1対1で対応する」を
 * 孤立検証する。クリックは props を変えない（制御コンポーネント）ので act fixture は
 * 持たず、board-toolbar と同じ prop バリエーション方式にする。i18n 非依存だが
 * 土台統一のため withVerifyProviders で包む。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { BoardViewSwitch } from './board-view-switch';

interface Props {
  viewType: 'daily' | 'weekly';
  onViewTypeChange: (viewType: 'daily' | 'weekly') => void;
}

const noop = () => {};

registerUnit<Props>({
  id: 'BoardViewSwitch',
  title: 'BoardViewSwitch',
  description: 'ボード右上の表示単位切り替え（Daily / Weekly）。',
  kind: 'component',
  render: (props) => withVerifyProviders(<BoardViewSwitch {...props} />),
  fixtures: [
    {
      id: 'daily',
      description: 'Daily 選択中',
      props: { viewType: 'daily', onViewTypeChange: noop },
    },
    {
      id: 'weekly',
      probe: true,
      description: 'Probe: 非デフォルト（Weekly）でも契約=props・2択構造が保たれる',
      props: { viewType: 'weekly', onViewTypeChange: noop },
    },
  ],
  invariants: [
    {
      id: 'viewtype-contract-matches-props',
      description: 'data-verify-view-type が props.viewType と一致する',
      check: ({ contract, props }) =>
        contract.viewType === props.viewType ||
        `viewType 契約不一致: props=${props.viewType} → contract=${contract.viewType}`,
    },
    {
      id: 'both-options-present',
      description: 'daily / weekly の2択が、どの状態でも描画される',
      check: ({ root }) => {
        const ids = Array.from(root.querySelectorAll('button[data-verify-view-option]'))
          .map((b) => b.getAttribute('data-verify-view-option'))
          .sort();
        return (
          (ids.length === 2 && ids[0] === 'daily' && ids[1] === 'weekly') ||
          `2択構造が崩れている: [${ids.join(', ')}]`
        );
      },
    },
    {
      id: 'pressed-matches-viewtype',
      description: 'aria-pressed=true は選択中の viewType ちょうど1つ',
      check: ({ root, contract }) => {
        const pressed = Array.from(root.querySelectorAll('button[aria-pressed="true"]')).map((b) =>
          b.getAttribute('data-verify-view-option'),
        );
        return (
          (pressed.length === 1 && pressed[0] === contract.viewType) ||
          `aria-pressed 不一致: viewType=${contract.viewType} → pressed=[${pressed.join(', ')}]`
        );
      },
    },
  ],
});
