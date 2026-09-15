/**
 * BackLink の検証スペック。
 *
 * 「サブ画面から書斎へ戻れる」（40-acceptance.md「ナビゲーション」）の PC 側。
 *
 * 見張るのは**置き場と見え方の約束**。出口は左上（3 巡「既存の操作に被る」）→ 下端
 * （操作パレットの真下）→ 上端の中央から垂れるタブ（どの画面にも属さない札に見える）と
 * 移してきた。いまは**各画面のヘッダーの先頭**。浮かせて席を空けさせる作りに戻ると、
 * また重なりと読み忘れの往復になる。
 */

import { registerUnit } from '@oryzae/verify';
import { BackLinkProvider } from '@/lib/back-link-context';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { BackLink } from './back-link';

interface Props {
  placement: 'inline' | 'corner';
}

registerUnit<Props>({
  id: 'BackLink',
  title: 'BackLink',
  description: 'サブ画面の左上の「‹ 書斎」。ヘッダーの先頭に並べるか、ヘッダーの無い画面の隅に置く',
  kind: 'component',
  render: (props) =>
    withVerifyProviders(
      <BackLinkProvider value={{ href: '/', label: '書斎', ariaLabel: '書斎に戻る' }}>
        <div className="flex items-center gap-3 p-6">
          <BackLink placement={props.placement} />
        </div>
      </BackLinkProvider>,
    ),
  fixtures: [
    {
      id: 'inline',
      probe: true,
      description: 'Probe: ヘッダーの行に並ぶ（エントリー・ボード）',
      props: { placement: 'inline' },
    },
    {
      id: 'corner',
      description: 'ヘッダーを持たない画面の左上（瓶・問いの変遷・アカウント）',
      props: { placement: 'corner' },
    },
  ],
  invariants: [
    {
      id: 'links-to-target',
      description: '行き先（書斎 /）へ行ける',
      check: ({ root }) =>
        Boolean(root.querySelector('a[href="/"]')) || '行き先（/）へのリンクが無い',
    },
    {
      id: 'says-where-it-goes',
      description: '山形だけにしない（行き先の名前が読める）。読み上げは動作まで言う',
      check: ({ root }) => {
        const link = root.querySelector('a');
        if (!link) return 'リンクが無い';
        if (!(link.textContent ?? '').includes('書斎')) return '行き先の名前が見えない';
        return link.getAttribute('aria-label') === '書斎に戻る' || '読み上げの名前が無い';
      },
    },
    {
      id: 'has-no-surface',
      description: '面も縁も持たない（道具のチップと同じ面にすると、道具が 1 つ増えて見える）',
      check: ({ root }) => {
        const className = root.querySelector('a')?.className ?? '';
        if (/\bborder\b/.test(className)) return '縁が付いている';
        return !className.includes('surface-raised') || '浮いたチップの面になっている';
      },
    },
    {
      id: 'never-hangs-from-the-center',
      description: '上端の中央に戻さない（どの画面にも属さない札に見える）',
      check: ({ root }) => {
        const classNames = [...root.querySelectorAll('*')].map((el) => el.className).join(' ');
        if (classNames.includes('inset-x-0')) return '上端いっぱいに広げている';
        return !classNames.includes('left-1/2') || '中央に寄せている';
      },
    },
  ],
});
