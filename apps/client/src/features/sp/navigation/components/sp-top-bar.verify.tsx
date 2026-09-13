/**
 * SpTopBar の検証スペック（SP のサブ画面の上段）。
 *
 * 守るのは骨格: 左端に戻る、右端は画面ごとの設定の席（空でも幅を持つ）、中央は状態だけ。
 * 戻るは既定で書斎（/）へのリンクで、画面が横取りしていればボタンになる。
 * 右端がアカウントへのリンクになることは無い（実機レビュー: 「歯車がマイページに飛ぶのは謎」）。
 */

import { registerUnit } from '@oryzae/verify';
import { GearIcon, RoundButton } from '@/components/ui/round-button';
import {
  placeInSlot,
  SpChromeProvider,
  useSpBackHandler,
  useSpChrome,
  useSpStatus,
} from '@/lib/sp-chrome-context';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { SpTopBar } from './sp-top-bar';

interface Props {
  /** 画面が「戻る」を横取りしている状態を再現する。 */
  overrideBack?: boolean;
  status?: string;
  /** 画面が右端の席に設定を差し込んでいる状態を再現する。 */
  withAction?: boolean;
}

const noop = () => {};

function Screen({ overrideBack = false, status = '', withAction = false }: Props) {
  useSpBackHandler(overrideBack ? noop : null);
  useSpStatus(status, 'ok');
  const { actionSlot } = useSpChrome();
  if (!withAction) return null;
  return placeInSlot(
    <RoundButton ariaLabel="設定" onClick={noop}>
      <GearIcon />
    </RoundButton>,
    actionSlot,
  );
}

registerUnit<Props>({
  id: 'SpTopBar',
  title: 'SpTopBar',
  description: 'SP のサブ画面の上段: 左端に正円の戻る、右端に画面ごとの設定の席、中央に状態',
  kind: 'component',
  render: (props) =>
    withVerifyProviders(
      <SpChromeProvider>
        <div style={{ width: '390px' }}>
          <SpTopBar />
          <Screen {...props} />
        </div>
      </SpChromeProvider>,
    ),
  fixtures: [
    { id: 'default', probe: true, description: 'Probe: 書斎へ戻るリンク、右端は空', props: {} },
    {
      id: 'with-action',
      description: '画面が右端に設定を差し込んでいる',
      props: { withAction: true },
    },
    {
      id: 'override-back',
      probe: true,
      description: 'Probe: 画面が戻るを横取りしているとボタンになる',
      props: { overrideBack: true },
    },
    {
      id: 'with-status',
      description: '中央に状態（保存しました）',
      props: { status: '保存しました' },
    },
  ],
  invariants: [
    {
      id: 'back-is-link-unless-overridden',
      description: '戻るは既定で書斎（/）へのリンク、横取りされていればボタン',
      check: ({ root, contract }) => {
        const link = root.querySelector('header a[href="/"]') !== null;
        const overridden = contract.overridesBack === 'true';
        return link === !overridden || `link=${link} だが overridesBack=${contract.overridesBack}`;
      },
    },
    {
      id: 'never-links-to-account',
      description: '右端がアカウントへのリンクになることは無い',
      check: ({ root }) =>
        root.querySelector('header a[href="/account"]') === null || 'アカウントへのリンクがある',
    },
    {
      id: 'action-slot-present',
      description: '右端の席は常にある（空でも幅を持つ）',
      check: ({ root }) => root.querySelector('[data-sp-action-slot]') !== null || '席が無い',
    },
    {
      id: 'action-lands-in-slot',
      description: '画面が差し込んだ設定は右端の席に入る',
      onlyFixtures: ['with-action'],
      check: ({ root }) =>
        root.querySelector('[data-sp-action-slot] button') !== null || '席に設定が入っていない',
    },
    {
      id: 'status-in-center',
      description: '状態は中央の 1 行に出る',
      onlyFixtures: ['with-status'],
      check: ({ root }) =>
        (root.querySelector('header [aria-live]')?.textContent ?? '').includes('保存しました') ||
        '状態が出ていない',
    },
  ],
});
