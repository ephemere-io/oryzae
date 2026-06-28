/**
 * BoardControls の検証スペック（A 移植）。
 * 完全制御（state を持たない）の純表示コントロール。viewType（daily/weekly）を
 * 契約として公表し、「契約↔props 一致」「4ボタン構造（Daily/Weekly トグル＋Snippet/Photo）が
 * どの viewType でも保たれる」を invariant で孤立検証する。クリックは props を変えない
 * （制御コンポーネント）ので act fixture は持たず、editor-status-bar と同じ prop バリエーション
 * 方式にする。i18n 非依存だが土台統一のため withVerifyProviders で包む。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { BoardControls } from './board-controls';

interface Props {
  viewType: 'daily' | 'weekly';
  onViewTypeChange: (viewType: 'daily' | 'weekly') => void;
  onAddSnippet: () => void;
  onAddPhoto: () => void;
}

const noop = () => {};

registerUnit<Props>({
  id: 'BoardControls',
  title: 'BoardControls',
  description: 'ボード右上のコントロール（Daily/Weekly トグル＋Snippet/Photo 追加）。',
  kind: 'component',
  render: (props) => withVerifyProviders(<BoardControls {...props} />),
  fixtures: [
    {
      id: 'daily',
      description: 'Daily ビュー選択中',
      props: { viewType: 'daily', onViewTypeChange: noop, onAddSnippet: noop, onAddPhoto: noop },
    },
    {
      id: 'weekly',
      probe: true,
      description: 'Probe: 非デフォルト（Weekly）でも契約=props・4ボタン構造が保たれる',
      props: { viewType: 'weekly', onViewTypeChange: noop, onAddSnippet: noop, onAddPhoto: noop },
    },
  ],
  invariants: [
    {
      id: 'viewtype-contract-matches-props',
      description: 'data-verify-view-type が props.viewType と一致する',
      check: ({ contract, props }) =>
        contract.viewType === props.viewType ||
        `viewType 契約不一致: props.viewType=${props.viewType} → contract.viewType=${contract.viewType}`,
    },
    {
      id: 'four-buttons-present',
      description: 'Daily/Weekly トグルと Snippet/Photo 追加の計4ボタンが描画される',
      check: ({ root }) => {
        const buttons = Array.from(root.querySelectorAll('button'));
        const labels = buttons.map((b) => b.textContent?.trim() ?? '');
        const hasDaily = labels.some((l) => l.includes('Daily'));
        const hasWeekly = labels.some((l) => l.includes('Weekly'));
        const hasSnippet = labels.some((l) => l.includes('Snippet'));
        const hasPhoto = labels.some((l) => l.includes('Photo'));
        return (
          (buttons.length === 4 && hasDaily && hasWeekly && hasSnippet && hasPhoto) ||
          `4ボタン構造が崩れている: count=${buttons.length}, labels=[${labels.join(', ')}]`
        );
      },
    },
  ],
});
