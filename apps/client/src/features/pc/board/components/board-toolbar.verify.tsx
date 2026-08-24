/**
 * BoardToolbar の検証スペック。
 *
 * 完全制御（state を持たない）の道具箱。activeTool を契約として公表し、
 * 「契約↔props 一致」「2つの道具（スニペット作成／画像を貼り付け）が
 * どの activeTool でも欠けない」「aria-pressed が activeTool と1対1で対応する」を
 * 孤立検証する。クリックは props を変えない（制御コンポーネント）ので act fixture は
 * 持たず、board-controls / editor-status-bar と同じ prop バリエーション方式にする。
 * i18n 依存なので withVerifyProviders で包む。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { BoardToolbar } from './board-toolbar';

interface Props {
  activeTool: 'none' | 'snippet' | 'photo';
  onCreateSnippet: () => void;
  onAddPhoto: () => void;
}

const noop = () => {};

function pressedTools(root: ParentNode): string[] {
  return Array.from(root.querySelectorAll('button[aria-pressed="true"]'))
    .map((b) => b.getAttribute('data-verify-tool') ?? '')
    .sort();
}

registerUnit<Props>({
  id: 'BoardToolbar',
  title: 'BoardToolbar',
  description: 'ボード下部中央のフローティングツールバー（スニペット作成／画像を貼り付け）。',
  kind: 'component',
  render: (props) => withVerifyProviders(<BoardToolbar {...props} />),
  fixtures: [
    {
      id: 'idle',
      description: 'どのダイアログも開いていない（道具は未選択）',
      props: { activeTool: 'none', onCreateSnippet: noop, onAddPhoto: noop },
    },
    {
      id: 'snippet-active',
      description: 'スニペット作成ダイアログを開いている',
      props: { activeTool: 'snippet', onCreateSnippet: noop, onAddPhoto: noop },
    },
    {
      id: 'photo-active',
      probe: true,
      description: 'Probe: 非デフォルト（画像側が選択中）でも契約=props・2道具構造が保たれる',
      props: { activeTool: 'photo', onCreateSnippet: noop, onAddPhoto: noop },
    },
  ],
  invariants: [
    {
      id: 'active-tool-contract-matches-props',
      description: 'data-verify-active-tool が props.activeTool と一致する',
      check: ({ contract, props }) =>
        contract.activeTool === props.activeTool ||
        `activeTool 契約不一致: props=${props.activeTool} → contract=${contract.activeTool}`,
    },
    {
      id: 'two-tools-present',
      description: 'スニペット作成と画像を貼り付けの2ボタンが、どの状態でも描画される',
      check: ({ root }) => {
        const ids = Array.from(root.querySelectorAll('button[data-verify-tool]'))
          .map((b) => b.getAttribute('data-verify-tool'))
          .sort();
        return (
          (ids.length === 2 && ids[0] === 'photo' && ids[1] === 'snippet') ||
          `2道具構造が崩れている: [${ids.join(', ')}]`
        );
      },
    },
    {
      id: 'pressed-matches-active-tool',
      description: 'aria-pressed=true の道具は activeTool ちょうど1つ（none のときは0個）',
      check: ({ root, props }) => {
        const pressed = pressedTools(root);
        const expected = props.activeTool === 'none' ? [] : [props.activeTool];
        return (
          (pressed.length === expected.length && pressed.every((id, i) => id === expected[i])) ||
          `aria-pressed 不一致: activeTool=${props.activeTool} → pressed=[${pressed.join(', ')}]`
        );
      },
    },
    {
      id: 'every-tool-has-tooltip-and-shortcut',
      description: '各道具にツールチップがあり、aria-label にショートカットが含まれる',
      check: ({ root }) => {
        const slots = Array.from(root.querySelectorAll('button[data-verify-tool]'));
        const bad = slots.filter((button) => {
          const label = button.getAttribute('aria-label') ?? '';
          const tool = button.getAttribute('data-verify-tool');
          const tooltip = button.parentElement?.querySelector(`[data-verify-tooltip="${tool}"]`);
          return !/\([A-Z]\)$/.test(label) || tooltip === null || tooltip === undefined;
        });
        return (
          bad.length === 0 ||
          `ツールチップ/ショートカット欠落: [${bad
            .map((b) => b.getAttribute('data-verify-tool'))
            .join(', ')}]`
        );
      },
    },
  ],
});
