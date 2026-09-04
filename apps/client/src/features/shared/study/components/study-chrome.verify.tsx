/**
 * StudyChrome の検証スペック。
 *
 * 書斎に浮かぶ唯一の UI。**readiness を数値で出さない**という規則（00-overview.md
 * 「コピー」）が守られていることを、ここで機械的に見る。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import type { StudyFermentationStatus } from '../types';
import { StudyChrome } from './study-chrome';

interface Props {
  status: StudyFermentationStatus;
  readiness: number;
  initial: string;
  avatarUrl?: string | null;
  showCaption?: boolean;
}

registerUnit<Props>({
  id: 'StudyChrome',
  title: 'StudyChrome',
  description: '書斎のフローティング UI（マーク・アバター・状態キャプション）',
  kind: 'component',
  render: (props) => withVerifyProviders(<StudyChrome {...props} />),
  fixtures: [
    {
      id: 'idle',
      description: 'まだ何も無い',
      props: { status: 'idle', readiness: 0, initial: 'A' },
    },
    {
      id: 'fermenting',
      description: '発酵中',
      props: { status: 'fermenting', readiness: 0.45, initial: 'A' },
    },
    {
      id: 'almost',
      probe: true,
      description: 'Probe: readiness 0.9 以上で「もうすぐ」に言い換わる',
      props: { status: 'fermenting', readiness: 0.93, initial: 'A' },
    },
    {
      id: 'completed',
      description: '手紙が届いている',
      props: { status: 'completed', readiness: 1, initial: 'A' },
    },
    {
      id: 'sp-no-caption',
      probe: true,
      description: 'Probe: SP はキャプションを出さない（下端のナビと競合する）',
      props: { status: 'fermenting', readiness: 0.5, initial: 'A', showCaption: false },
    },
  ],
  invariants: [
    {
      id: 'no-numeric-readiness',
      description: 'readiness を数値（％や小数）で出さない',
      check: ({ root, props }) => {
        const text = root.textContent ?? '';
        if (text.includes('%')) return '％表記が出ている';
        const percent = String(Math.round(props.readiness * 100));
        // 0 と 1 は他の文言に紛れうるので、意味のある値だけを見る。
        if (props.readiness > 0.01 && text.includes(percent)) {
          return `readiness の数値 "${percent}" が出ている`;
        }
        return true;
      },
    },
    {
      id: 'status-key-contract',
      description: '状態語が status と readiness の組から決まる',
      check: ({ contract, props }) => {
        const expected =
          props.status === 'completed'
            ? 'status_completed'
            : props.status === 'idle'
              ? 'status_idle'
              : props.readiness >= 0.9
                ? 'status_almost'
                : 'status_fermenting';
        return (
          contract.statusKey === expected ||
          `statusKey 不一致: expected=${expected} actual=${contract.statusKey}`
        );
      },
    },
    {
      id: 'account-link',
      description: 'アバターから /account に行ける',
      check: ({ root }) =>
        Boolean(root.querySelector('a[href="/account"]')) || 'アカウントへのリンクが無い',
    },
    {
      id: 'no-unread-badge',
      description: '未読の数字バッジを出さない（届いたことは瓶の封が伝える）',
      check: ({ root }) => {
        // サイドバーが使っていたテラコッタは書斎では使わない。
        const html = root.innerHTML.toUpperCase();
        return !html.includes('D4714E') || 'テラコッタのバッジ色が使われている';
      },
    },
    {
      id: 'caption-toggles',
      description: 'showCaption=false でキャプションを出さない',
      check: ({ root, props }) => {
        const hasCaption = Boolean(root.textContent?.includes('STUDY'));
        const expected = props.showCaption !== false;
        return hasCaption === expected || `キャプションの出し分けが契約と違う`;
      },
    },
  ],
});
