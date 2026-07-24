/**
 * SettingsDrawer の検証スペック（A 移植）。
 * props で完全に制御される設定ドロワー。i18n（useTranslations）を withVerifyProviders で供給し、
 * conditional な DOM（時間内包の RadioGroup / ゴーストの Slider 群）が契約と一致することを検証する。
 *
 * 注意: 本コンポーネントは状態を内部に持たない controlled component（onChange は親へ委譲）。
 * fixture の親は再レンダリングしないため、クリックで checkbox が反転する類の act は書かない。
 * 代わりに props を振り分けた fixture と probe で各分岐を網羅する。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { DEFAULT_SETTINGS, type EditorSettings, SettingsDrawer } from './settings-drawer';

interface Props {
  open: boolean;
  settings: EditorSettings;
  onChange: (patch: Partial<EditorSettings>) => void;
  onClose: () => void;
}

const noop = () => {};

const allEffectsOn: EditorSettings = {
  ...DEFAULT_SETTINGS,
  timeInscriptionEnabled: true,
  timeInscriptionMode: 'fontWeight',
  ghostEnabled: true,
  ghostMode: 'dust',
  fermentationOverlayPreference: 'always',
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
  fermentationOverlayPreference: 'never',
};

registerUnit<Props>({
  id: 'SettingsDrawer',
  title: 'SettingsDrawer',
  description: 'エディタ設定ドロワー（props で制御。時間内包/ゴーストで子UIが出現）。',
  kind: 'component',
  render: (props) => withVerifyProviders(<SettingsDrawer {...props} />),
  fixtures: [
    {
      id: 'default',
      description: '初期設定（エフェクト無効 → 最小ツリー）',
      props: { open: true, settings: DEFAULT_SETTINGS, onChange: noop, onClose: noop },
    },
    {
      id: 'all-effects-on',
      description: '時間内包＋ゴースト有効 → ネストした RadioGroup / Slider 群が出現',
      props: { open: true, settings: allEffectsOn, onChange: noop, onClose: noop },
    },
    {
      id: 'boundary-stress',
      probe: true,
      description:
        'Probe: 全トグルON＋数値が上限（fontSize48 / ghostSize200 / blur極大）でもレイアウトが崩れない',
      props: { open: true, settings: boundaryStress, onChange: noop, onClose: noop },
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
      description:
        'timeInscriptionEnabled 契約が true のときだけ ti-mode の RadioGroup が描画される',
      check: ({ root, contract }) => {
        const hasTiRadio = Boolean(root.querySelector('input[name="ti-mode"]'));
        const enabled = contract.timeInscriptionEnabled === 'true';
        return (
          hasTiRadio === enabled ||
          `ti DOM/contract 不一致: contract.timeInscriptionEnabled=${contract.timeInscriptionEnabled}, ti-mode存在=${hasTiRadio}`
        );
      },
    },
    {
      id: 'fermentation-preference-checked-matches-props',
      description:
        'チェック済みの発酵オーバーレイ radio の value が props.settings.fermentationOverlayPreference と一致する',
      check: ({ root, props }) => {
        const checked = root.querySelector<HTMLInputElement>(
          'input[name="fermentation-overlay-preference"]:checked',
        );
        return (
          checked?.value === props.settings.fermentationOverlayPreference ||
          `checked radio value="${checked?.value}", expected="${props.settings.fermentationOverlayPreference}"`
        );
      },
    },
  ],
});
