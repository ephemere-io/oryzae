/**
 * AuthStatus の検証スペック。
 *
 * 通り道の画面（Google から戻った先・メールのリンクの先）の紙。守るのは
 * 「**確かめている間は操作を置かない、通らなかったら戻り道を必ず置く**」。
 * 以前この画面は、小さな「認証中...」と言語の選択欄だけが浮いていて、失敗したときに
 * どこへ行けばよいかも分からなかった。
 */

import { registerUnit } from '@oryzae/verify';
import { AuthStatus, type AuthStatusProps } from './auth-status';

registerUnit<AuthStatusProps>({
  id: 'AuthStatus',
  title: 'AuthStatus',
  description: '認証の通り道（/callback・/auth/confirm）で扉の前に置く紙',
  kind: 'component',
  render: (props) => <AuthStatus {...props} />,
  fixtures: [
    {
      id: 'pending',
      description: '確かめている最中（点が明滅し、文言だけを出す）',
      props: { state: 'pending', message: '認証中...' },
    },
    {
      id: 'error',
      description: '通らなかった（理由とログインへの戻り道）',
      props: {
        state: 'error',
        message: '認証に失敗しました。もう一度お試しください。',
        backLabel: 'ログインに戻る',
      },
    },
    {
      id: 'pending-ignores-back-label',
      probe: true,
      description: 'Probe: pending に戻り道の文言を渡しても、戻り道は出さない',
      props: { state: 'pending', message: '確認中...', backLabel: 'ログインに戻る' },
    },
  ],
  invariants: [
    {
      id: 'pending-has-no-controls',
      description: '確かめている間は押せる物を置かない（言語の選択欄もボタンも）',
      check: ({ root, contract }) => {
        if (contract.state !== 'pending') return true;
        const controls = root.querySelectorAll('a, button, select, input').length;
        return controls === 0 || `pending なのに押せる物が ${controls} 個ある`;
      },
    },
    {
      id: 'error-has-way-back',
      description: '通らなかったら、理由（role=alert）とログインへの戻り道を必ず置く',
      check: ({ root, contract }) => {
        if (contract.state !== 'error') return true;
        const alert = root.querySelector('[role="alert"]');
        const back = root.querySelector('a[href="/login"]');
        return (
          (alert !== null && back !== null && contract.hasBackLink === 'true') ||
          `alert=${alert !== null}, back=${back !== null}, hasBackLink=${contract.hasBackLink}`
        );
      },
    },
    {
      id: 'names-the-place',
      description: 'どの画面でも名前（Oryzae）を見出しに持つ（何の画面か分からない紙にしない）',
      check: ({ root }) => {
        const heading = root.querySelector('h1')?.textContent?.trim();
        return heading === 'Oryzae' || `見出しが "${heading}"`;
      },
    },
  ],
});
