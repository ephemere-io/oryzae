/**
 * UnsubscribePanel の検証スペック。
 *
 * 配信停止ページは **ログインしていない人が、メールから 1 回だけ訪れる** 画面で、
 * 失敗しても本人は何も手を打てない。だから固定するのは見た目ではなく:
 *   1. 停止できたときに「戻す」手段が必ず出ること（押し間違いの退路）
 *   2. 退会したと誤解させないこと（アカウントと日記は残る、と書く）
 *   3. 失敗したときに次の手（設定画面）を案内すること
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import type { UnsubscribeState } from '../types';
import { UnsubscribePanel } from './unsubscribe-panel';

interface Props {
  state: UnsubscribeState;
}

registerUnit<Props>({
  id: 'UnsubscribePanel',
  title: 'UnsubscribePanel',
  description: 'メールの配信停止リンクから来る公開ページ（/unsubscribe）の中身',
  kind: 'component',
  render: (props) =>
    withVerifyProviders(<UnsubscribePanel state={props.state} onResubscribe={() => {}} />),
  fixtures: [
    {
      id: 'working',
      description: '開いた直後（POST 中）',
      props: { state: { status: 'working' } },
    },
    {
      id: 'unsubscribed',
      probe: true,
      description: 'Probe: 停止できた — 戻す手段とアカウントが残る旨を必ず出す',
      props: { state: { status: 'unsubscribed' } },
    },
    {
      id: 'resubscribed',
      description: '「やっぱり受け取る」を押したあと',
      props: { state: { status: 'resubscribed' } },
    },
    {
      id: 'error',
      probe: true,
      description: 'Probe: リンクが無効 — サーバーの文言と次の手を出す',
      props: {
        state: { status: 'error', message: 'このリンクは無効です。' },
      },
    },
  ],
  invariants: [
    {
      id: 'state-is-published',
      description: 'どの状態かを DOM 契約として公表する',
      check: ({ root, props }) => {
        const el = root.querySelector('[data-verify-unit="UnsubscribePanel"]');
        const actual = el?.getAttribute('data-verify-state');
        return actual === props.state.status || `state 属性が不一致: ${actual}`;
      },
    },
    {
      id: 'undo-exists-when-unsubscribed',
      description: '停止できたときは必ず「戻す」ボタンを出す（押し間違いの退路）',
      check: ({ root, props }) => {
        if (props.state.status !== 'unsubscribed') return true;
        return (
          root.querySelector('button') !== null ||
          '停止後に戻す手段が無い（誤って押した人がログインなしで復帰できない）'
        );
      },
    },
    {
      id: 'does-not-read-as-account-deletion',
      description: '停止できたときはアカウントと日記が残ることを明示する',
      check: ({ root, props }) => {
        if (props.state.status !== 'unsubscribed') return true;
        const text = root.textContent ?? '';
        return (
          text.includes('アカウント') || '「解除」だけだと退会したと読める。残るものを明示する'
        );
      },
    },
    {
      id: 'error-shows-server-message',
      description: '失敗時はサーバーの文言をそのまま出す（原因が分かる唯一の手がかり）',
      check: ({ root, props }) => {
        if (props.state.status !== 'error') return true;
        const text = root.textContent ?? '';
        return text.includes(props.state.message) || 'サーバーのエラー文言が表示されていない';
      },
    },
  ],
});
