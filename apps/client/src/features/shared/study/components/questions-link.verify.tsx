/**
 * QuestionsLink の検証スペック。
 *
 * この部品の存在理由は「サイドバーを外して消えた `/questions` への道を返すこと」なので、
 * 守るのは**行き先が生きていること**と、**左上（書斎へ戻る）の席を奪わないこと**。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { QuestionsLink } from './questions-link';

registerUnit<Record<string, never>>({
  id: 'QuestionsLink',
  title: 'QuestionsLink',
  description: '瓶の画面から「問いの変遷」へ行く導線（右上）',
  kind: 'component',
  render: () => withVerifyProviders(<QuestionsLink />),
  fixtures: [
    {
      id: 'default',
      probe: true,
      description: 'Probe: /questions へのリンクとして機能する',
      props: {},
    },
  ],
  invariants: [
    {
      id: 'links-to-questions',
      description: '/questions へ行ける（問いの変遷はあの画面にしかない）',
      check: ({ root }) =>
        Boolean(root.querySelector('a[href="/questions"]')) || '/questions へのリンクが無い',
    },
    {
      id: 'keeps-the-left-seat-free',
      description: '左上は「書斎へ戻る」の席なので、そこに置かない',
      check: ({ root }) => {
        const link = root.querySelector('a');
        const className = link?.className ?? '';
        if (className.includes('left-6')) return '左上（書斎へ戻るの席）に重なっている';
        return className.includes('right-6') || '右上に置かれていない';
      },
    },
    {
      id: 'sits-with-the-back-mark',
      description: '「書斎へ戻る」と同じ層（エディタに潜らず、モーダルより前に出ない）',
      check: ({ root }) => {
        const link = root.querySelector('a');
        const className = link?.className ?? '';
        return className.includes('z-[55]') || 'BackToStudy と重なり順が揃っていない';
      },
    },
    {
      id: 'has-a-readable-name',
      description: 'アイコンだけにしない（何の一覧か文字で読める）',
      check: ({ root }) => {
        const text = (root.textContent ?? '').trim();
        return text.length > 0 || '文字が無く、アイコンだけになっている';
      },
    },
  ],
});
