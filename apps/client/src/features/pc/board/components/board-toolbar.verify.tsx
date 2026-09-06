/**
 * BoardToolbar の検証スペック。
 *
 * 完全制御（state を持たない）の道具箱。選択の有無で**中身が入れ替わる**のが要点で、
 * 何も選んでいなければ作成系の4道具（スニペット/読み取り/エントリー/画像）、カードを選んで
 * いればそのカードにできること（開く/前面へ/削除）を出す。
 *
 * 検証する契約:
 *   - mode が selection の有無と一致する
 *   - 作成モードでは4道具が必ず揃い、aria-pressed が activeTool と1対1
 *   - 選択モードでは card アクションが3つ揃い、作成系は出ない（入れ替わりが起きている）
 *   - 操作の名前は種別で変えない（例外は「日記を開く」だけ）
 *
 * クリックは props を変えない（制御コンポーネント）ので act fixture は持たず、
 * prop バリエーション方式にする。i18n 依存なので withVerifyProviders で包む。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { BoardToolbar } from './board-toolbar';

interface Props {
  activeTool: 'none' | 'snippet' | 'ocr' | 'photo';
  onCreateSnippet: () => void;
  onReadImage: () => void;
  onAddPhoto: () => void;
  selection: { cardType: 'snippet' | 'photo' } | null;
  onOpenSelected: () => void;
  onBringSelectedToFront: () => void;
  onDeleteSelected: () => void;
  onEditSelectedOnCard?: () => void;
}

const noop = () => {};

/** 選択が無いときの標準 props。fixture ごとに差分だけ上書きする。 */
const base: Props = {
  activeTool: 'none',
  onCreateSnippet: noop,
  onReadImage: noop,
  onAddPhoto: noop,
  selection: null,
  onOpenSelected: noop,
  onBringSelectedToFront: noop,
  onDeleteSelected: noop,
  onEditSelectedOnCard: noop,
};

function pressedTools(root: ParentNode): string[] {
  return Array.from(root.querySelectorAll('button[aria-pressed="true"]'))
    .map((b) => b.getAttribute('data-verify-tool') ?? '')
    .sort();
}

function toolIds(root: ParentNode): string[] {
  return Array.from(root.querySelectorAll('button[data-verify-tool]'))
    .map((b) => b.getAttribute('data-verify-tool') ?? '')
    .sort();
}

function actionIds(root: ParentNode): string[] {
  return Array.from(root.querySelectorAll('button[data-verify-card-action]'))
    .map((b) => b.getAttribute('data-verify-card-action') ?? '')
    .sort();
}

registerUnit<Props>({
  id: 'BoardToolbar',
  title: 'BoardToolbar',
  description:
    'ボード下部中央のフローティングツールバー。選択が無ければ作成系、カードを選べばそのカードの操作。',
  kind: 'component',
  render: (props) => withVerifyProviders(<BoardToolbar {...props} />),
  fixtures: [
    {
      id: 'idle',
      description: '何も選んでいない（作成系の3道具・未選択）',
      props: base,
    },
    {
      id: 'snippet-active',
      description: 'スニペット作成ダイアログを開いている',
      props: { ...base, activeTool: 'snippet' },
    },
    {
      id: 'photo-active',
      probe: true,
      description: 'Probe: 非デフォルト（画像側が選択中）でも契約=props・道具の構成が保たれる',
      props: { ...base, activeTool: 'photo' },
    },
    {
      id: 'ocr-active',
      description: '画像から読み取るを選んでいる（作成ダイアログが画像タブで開く）',
      props: { ...base, activeTool: 'ocr' },
    },
    {
      id: 'snippet-selected',
      probe: true,
      description: 'Probe: スニペットカードを選ぶと、作成系が消えてカードの操作に入れ替わる',
      props: { ...base, selection: { cardType: 'snippet' } },
    },
    {
      id: 'photo-selected',
      probe: true,
      description: 'Probe: 写真カードを選んだとき（文言はスニペットと同じ）',
      props: { ...base, selection: { cardType: 'photo' } },
    },
  ],
  invariants: [
    {
      id: 'mode-matches-selection',
      description: 'mode 契約が selection の有無と一致する',
      check: ({ contract, props }) => {
        const expected = props.selection ? 'card' : 'create';
        return (
          contract.mode === expected ||
          `mode 不一致: selection=${JSON.stringify(props.selection)} → contract.mode=${contract.mode}`
        );
      },
    },
    {
      id: 'active-tool-contract-matches-props',
      description: 'data-verify-active-tool が props.activeTool と一致する',
      check: ({ contract, props }) =>
        contract.activeTool === props.activeTool ||
        `activeTool 契約不一致: props=${props.activeTool} → contract=${contract.activeTool}`,
    },
    {
      id: 'create-tools-when-nothing-selected',
      description: '選択が無いときは作成系の3道具が揃い、カード操作は出ない',
      check: ({ root, props }) => {
        if (props.selection) return true;
        const ids = toolIds(root);
        const actions = actionIds(root);
        return (
          (ids.join(',') === 'ocr,photo,snippet' && actions.length === 0) ||
          `作成モードの構造が崩れている: tools=[${ids.join(', ')}] actions=[${actions.join(', ')}]`
        );
      },
    },
    {
      id: 'card-actions-replace-tools-when-selected',
      description: 'カードを選んでいるときは操作が出て、作成系は消える（入れ替わっている）',
      check: ({ root, props }) => {
        if (!props.selection) return true;
        const ids = toolIds(root);
        const actions = actionIds(root);
        const expected = 'delete,front,open';
        return (
          (actions.join(',') === expected && ids.length === 0) ||
          `選択モードの構造が崩れている: actions=[${actions.join(', ')}] tools=[${ids.join(', ')}]`
        );
      },
    },
    {
      id: 'no-edit-action-on-card',
      description: 'カードの上で直す操作は出さない（盤面は貼る場所で、書くのは日記の画面）',
      check: ({ root, props }) => {
        if (!props.selection) return true;
        const hasEdit = root.querySelector('button[data-verify-card-action="edit"]') !== null;
        return !hasEdit || '「編集」がカード操作に出ている';
      },
    },
    {
      id: 'action-wording-is-shared-across-types',
      description: '操作の名前は種別で変えない',
      // 同じ形の操作に別々の言葉を当てると、「これは違う何かなのでは」と読ませてしまう。
      check: ({ root, props }) => {
        if (!props.selection) return true;
        const label = (id: string) =>
          (root.querySelector(`button[data-verify-card-action="${id}"]`)?.textContent ?? '').trim();
        const del = label('delete');
        const front = label('front');
        if (!del || !front) return '削除／前面へのボタンが見つからない';
        // 種別に紐づく語（外す・remove）を混ぜない
        const typeSpecific = /外す|remove/i.test(del);
        return !typeSpecific || `削除の文言が種別に寄っている: "${del}"`;
      },
    },
    {
      id: 'pressed-matches-active-tool',
      description: 'aria-pressed=true の道具は activeTool ちょうど1つ（none のときは0個）',
      check: ({ root, props }) => {
        if (props.selection) return true;
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
      check: ({ root, props }) => {
        if (props.selection) return true;
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
    {
      id: 'shortcut-rendered-as-kbd',
      description: 'ショートカットは kbd で描く（薄い1文字だと記号と見分けがつかない）',
      check: ({ root, props }) => {
        if (props.selection) return true;
        const tooltips = Array.from(root.querySelectorAll('[data-verify-tooltip]'));
        const bad = tooltips.filter((tip) => tip.querySelector('kbd') === null);
        return (
          bad.length === 0 ||
          `kbd が無いツールチップ: [${bad
            .map((t) => t.getAttribute('data-verify-tooltip'))
            .join(', ')}]`
        );
      },
    },
  ],
});
