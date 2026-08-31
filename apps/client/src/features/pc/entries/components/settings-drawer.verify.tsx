/**
 * SettingsDrawer（設定パネル）の検証スペック。
 *
 * props で完全に制御される表示部品。i18n（useTranslations）を withVerifyProviders で供給し、
 * conditional な DOM（時間内包の表し方 Select / ゴーストの Slider 群）が契約と一致することを検証する。
 *
 * 開閉と位置決めは呼び出し側の `Popover` が持つので、このユニットは**中身だけ**を描く。
 * 状態を内部に持たない controlled component（onChange は親へ委譲）なので、fixture の親は
 * 再レンダリングしない。クリックでトグルが反転する類の act は書かず、props を振り分けた
 * fixture と probe で分岐を網羅する。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { DEFAULT_SETTINGS, type EditorSettings, SettingsDrawer } from './settings-drawer';

interface Props {
  settings: EditorSettings;
  onChange: (patch: Partial<EditorSettings>) => void;
}

const noop = () => {};

const allEffectsOn: EditorSettings = {
  ...DEFAULT_SETTINGS,
  timeInscriptionEnabled: true,
  timeInscriptionMode: 'fontWeight',
  ghostEnabled: true,
  ghostMode: 'dust',
};

const boundaryStress: EditorSettings = {
  ...DEFAULT_SETTINGS,
  fontSize: 48,
  lineHeight: 2.5,
  focusModeEnabled: true,
  timeInscriptionEnabled: true,
  timeInscriptionMode: 'pressureBleed',
  eraserTraceEnabled: true,
  ampEnabled: true,
  voiceEnabled: true,
  ghostEnabled: true,
  ghostMode: 'block',
  ghostSize: 200,
  ghostScatter: 100,
  ghostBlurStart: 20,
  ghostBlurEnd: 40,
  ghostDuration: 250,
};

registerUnit<Props>({
  id: 'SettingsDrawer',
  title: 'SettingsDrawer',
  description: 'エディタ設定パネル（props で制御。時間内包/ゴーストで子UIが出現）。',
  kind: 'component',
  render: (props) => withVerifyProviders(<SettingsDrawer {...props} />),
  fixtures: [
    {
      id: 'default',
      description: '初期設定（エフェクト無効 → 最小ツリー）',
      props: { settings: DEFAULT_SETTINGS, onChange: noop },
    },
    {
      id: 'all-effects-on',
      description: '時間内包＋ゴースト有効 → 表し方 Select と Slider 群が出現',
      props: { settings: allEffectsOn, onChange: noop },
    },
    {
      id: 'boundary-stress',
      probe: true,
      description:
        'Probe: 全トグルON＋数値が上限（fontSize48 / ghostSize200 / blur極大）でもレイアウトが崩れない',
      props: { settings: boundaryStress, onChange: noop },
    },
  ],
  invariants: [
    {
      id: 'ghost-contract-matches-dom',
      description: 'ghostEnabled 契約が true のときだけゴースト用 Slider(#ghost-size) が描画される',
      check: ({ root, contract }) => {
        const hasGhostSlider = Boolean(root.querySelector('#ghost-size'));
        const enabled = contract.ghostEnabled === 'true';
        return (
          hasGhostSlider === enabled ||
          `ghost DOM/contract 不一致: contract.ghostEnabled=${contract.ghostEnabled}, #ghost-size存在=${hasGhostSlider}`
        );
      },
    },
    {
      id: 'time-inscription-contract-matches-dom',
      description: 'timeInscriptionEnabled 契約が true のときだけ「表し方」の Select が描画される',
      check: ({ root, contract, props }) => {
        const label = props.settings.timeInscriptionEnabled ? 1 : 0;
        const selects = root.querySelectorAll('[aria-haspopup="listbox"]').length;
        const enabled = contract.timeInscriptionEnabled === 'true';
        // 面に畳む Select は「選択肢が3つ以上」のものだけ。常設は「道具の大きさ」（3択）で、
        // 「時間の表し方」（3択）は時間内包が入のときにだけ増える。
        // 2択（書字方向・書体・ゴーストの表し方）は Segmented で開かせない。
        const expected = 1 + label;
        return (
          (enabled === (label === 1) && selects === expected) ||
          `Select 数=${selects}, 期待=${expected}（timeInscriptionEnabled=${contract.timeInscriptionEnabled}）`
        );
      },
    },
    {
      id: 'binary-choices-do-not-open',
      // 「縦か横か」に開く操作を挟むと、1クリックで済む切り替えが2クリックになる。
      description: '2択の設定は畳まずに並べて出す（Segmented）',
      check: ({ root, props }) => {
        const segmented = root.querySelectorAll('[data-verify-unit="Segmented"]').length;
        // 書字方向・書体は常設、ゴーストの表し方は ghostEnabled のときだけ。
        const expected = 2 + (props.settings.ghostEnabled ? 1 : 0);
        return segmented === expected || `Segmented 数=${segmented}, 期待=${expected}`;
      },
    },
    {
      id: 'no-native-select',
      description: 'ネイティブ <select> を使っていない（OS 依存の見た目を出さない）',
      check: ({ root }) =>
        root.querySelector('select') === null ||
        'ネイティブ <select> が残っている（Select コンポーネントに置き換えるべき）',
    },
    {
      id: 'rows-are-labelled',
      description: 'すべてのトグルが role="switch" と aria-checked を持つ（表記と操作の統一）',
      check: ({ root }) => {
        const switches = Array.from(root.querySelectorAll('[role="switch"]'));
        if (switches.length === 0) return 'トグルが1つも無い';
        const missing = switches.filter((s) => !s.hasAttribute('aria-checked'));
        return missing.length === 0 || `aria-checked の無い switch が ${missing.length} 個ある`;
      },
    },
    {
      id: 'no-prose-in-the-panel',
      // パネルは「何をどう変えるか」の一覧であって、読みものではない。
      // 説明が要るほど複雑な設定は、設定そのものを見直す合図。
      description: 'パネルに長い説明文を置かない',
      check: ({ root }) => {
        const longest = Array.from(root.querySelectorAll('section *'))
          .filter((el) => el.children.length === 0)
          .map((el) => (el.textContent ?? '').trim())
          .reduce((max, text) => Math.max(max, text.length), 0);
        return (
          longest <= 24 || `パネル内に ${longest} 文字の文がある（設定の一覧に散文は置かない）`
        );
      },
    },
  ],
});
