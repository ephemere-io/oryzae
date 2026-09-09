/**
 * StudyChrome の検証スペック。
 *
 * 書斎に浮かぶ唯一の UI。守るのは「**文字を置かない**」— 部屋の名前も発酵の状態も、
 * 物が既に語っているので UI では言い直さない（実機レビュー: もう少しすっきりさせたい）。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { StudyChrome } from './study-chrome';

interface Props {
  initial: string;
  avatarUrl?: string | null;
}

registerUnit<Props>({
  id: 'StudyChrome',
  title: 'StudyChrome',
  description: '書斎のフローティング UI（左上のマークと左下のアバターだけ）',
  kind: 'component',
  render: (props) => withVerifyProviders(<StudyChrome {...props} />),
  fixtures: [
    { id: 'default', description: 'アバターは頭文字', props: { initial: 'A' } },
    {
      id: 'with-avatar',
      probe: true,
      description: 'Probe: 画像があれば頭文字ではなく画像を出す',
      props: { initial: 'A', avatarUrl: 'https://example.test/a.png' },
    },
  ],
  invariants: [
    {
      id: 'no-caption',
      description: '部屋の名前も状態語も置かない（物が語っているものを言い直さない）',
      check: ({ root }) => {
        // 以前は下端に「書斎」と「手紙が届いています」を出していた。手紙が届いた
        // ことは瓶の封が伝える（未読の数字バッジを出さないのと同じ理由）。
        const caption = root.querySelector('[data-study-caption]');
        if (caption !== null) return 'キャプションが残っている';
        // アバターの頭文字以外に読める文字を置かない。
        const text = (root.textContent ?? '').replace(/\s/g, '');
        return text.length <= 1 || `文字が残っている: "${text.slice(0, 20)}"`;
      },
    },
    {
      id: 'mark-is-the-room',
      description: '左上は書斎の縮図（サブ画面の戻るマークと同じ絵）',
      check: ({ root }) => {
        // 以前は `o` の一文字で、何を指すのか読めなかった。
        const mark = root.querySelector('[data-study-mark]');
        return mark !== null || '左上に書斎のマークが無い';
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
      id: 'avatar-falls-back-to-initial',
      description: '画像が無ければ頭文字を出す（空の丸にしない）',
      check: ({ root, props }) => {
        const hasImage = root.querySelector('img') !== null;
        if (props.avatarUrl) return hasImage || '画像があるのに出していない';
        const text = (root.textContent ?? '').trim();
        return text.includes(props.initial) || '頭文字が出ていない';
      },
    },
  ],
});
