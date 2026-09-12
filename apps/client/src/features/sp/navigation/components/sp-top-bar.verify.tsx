/**
 * SpTopBar の検証スペック（SP のサブ画面の上段）。
 *
 * 守るのは骨格: 左端に戻る、右端に設定、中央は状態だけ。戻るは既定で書斎（/）への
 * リンクで、画面が横取りしていればボタンになる。
 */

import { registerUnit } from '@oryzae/verify';
import { SpChromeProvider, useSpBackHandler, useSpStatus } from '@/lib/sp-chrome-context';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { SpTopBar } from './sp-top-bar';

interface Props {
  showSettings?: boolean;
  /** 画面が「戻る」を横取りしている状態を再現する。 */
  overrideBack?: boolean;
  status?: string;
}

const noop = () => {};

function Screen({ overrideBack = false, status = '' }: Props) {
  useSpBackHandler(overrideBack ? noop : null);
  useSpStatus(status, 'ok');
  return null;
}

registerUnit<Props>({
  id: 'SpTopBar',
  title: 'SpTopBar',
  description: 'SP のサブ画面の上段: 左端に正円の戻る、右端に正円の設定、中央に状態',
  kind: 'component',
  render: (props) =>
    withVerifyProviders(
      <SpChromeProvider>
        <div style={{ width: '390px' }}>
          <SpTopBar showSettings={props.showSettings} />
          <Screen {...props} />
        </div>
      </SpChromeProvider>,
    ),
  fixtures: [
    { id: 'default', probe: true, description: 'Probe: 書斎へ戻るリンクと設定', props: {} },
    {
      id: 'no-settings',
      description: 'アカウント画面では設定を出さない（席は空ける）',
      props: { showSettings: false },
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
      id: 'back-is-first',
      description: '左端は戻る（書斎へのリンクか、横取りしたボタン）',
      check: ({ root, contract }) => {
        const header = root.querySelector('header');
        const first = header?.firstElementChild;
        if (!(first instanceof HTMLElement)) return '上段が無い';
        if (contract.overridesBack === 'true') {
          return first.tagName === 'BUTTON' || '横取り中なのにリンクのまま';
        }
        return (
          (first.tagName === 'A' && first.getAttribute('href') === '/') ||
          '左端が書斎（/）へのリンクでない'
        );
      },
    },
    {
      id: 'round-buttons',
      description: '戻ると設定は正円（44px）',
      check: ({ root }) => {
        const buttons = [...root.querySelectorAll('header a, header button')];
        const bad = buttons.filter(
          (b) => !(b.classList.contains('rounded-full') && b.classList.contains('h-11')),
        );
        return bad.length === 0 || `${bad.length} 個が正円でない`;
      },
    },
    {
      id: 'settings-iff-shown',
      description: '設定はアカウント画面以外で出す',
      check: ({ root, contract }) => {
        const gear = root.querySelector('header a[href="/account"]') !== null;
        return (
          gear === (contract.showSettings === 'true') ||
          `設定=${gear} だが showSettings=${contract.showSettings}`
        );
      },
    },
    {
      id: 'status-in-the-middle',
      description: '状態は中央にだけ、あるときだけ出す',
      check: ({ root, contract }) => {
        const text = root.querySelector('header span[aria-live]')?.textContent ?? '';
        return (
          text.length > 0 === (contract.hasStatus === 'true') ||
          `状態=${JSON.stringify(text)} だが hasStatus=${contract.hasStatus}`
        );
      },
    },
  ],
});
