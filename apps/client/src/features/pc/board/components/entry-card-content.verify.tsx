/**
 * EntryCardContent の検証スペック（A 移植）。
 * ボードカードに載る純表示部品（タイトル・プレビュー・日付）。props だけで孤立描画でき、
 * router / データ取得 / Selection API に依存しない。title の有無を契約として公表し、
 * 「h3 の有無が hasTitle 契約と一致」「整形済み日付が DOM に出る」を契約↔DOM で検証する。
 * i18n（useTranslations）は使わないが、テンプレ統一のため withVerifyProviders で包む。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { EntryCardContent } from './entry-card-content';

interface Content {
  title: string;
  preview: string;
  createdAt: string;
}

interface Props {
  content: Content;
}

registerUnit<Props>({
  id: 'EntryCardContent',
  title: 'EntryCardContent',
  description: 'ボードカードのエントリ表示内容（タイトル・プレビュー・日付）。',
  kind: 'component',
  render: (props) => withVerifyProviders(<EntryCardContent {...props} />),
  fixtures: [
    {
      id: 'with-title',
      description: 'タイトルあり（通常表示）',
      props: {
        content: {
          title: '朝のジャーナル',
          preview: '今日は早起きして散歩に出かけた。空気が澄んでいて気持ちよかった。',
          createdAt: '2026-06-27',
        },
      },
    },
    {
      id: 'no-title',
      description: 'タイトルなし（見出しを描画しない）',
      props: {
        content: {
          title: '',
          preview: 'タイトルを付けずに書き始めたメモ。',
          createdAt: '2026-05-01',
        },
      },
    },
    {
      id: 'empty-content',
      probe: true,
      description: 'Probe: タイトル・本文が空でも日付は描画されレイアウトが崩れない',
      props: {
        content: { title: '', preview: '', createdAt: '2026-01-15' },
      },
    },
  ],
  invariants: [
    {
      id: 'h3-iff-has-title',
      description: 'h3（タイトル見出し）の有無が hasTitle 契約と一致する',
      check: ({ root, contract }) => {
        const hasHeading = root.querySelector('h3') !== null;
        const expectTitle = contract.hasTitle === 'true';
        return (
          hasHeading === expectTitle ||
          `h3 present=${hasHeading} だが contract.hasTitle="${contract.hasTitle}"`
        );
      },
    },
    {
      id: 'formatted-date-rendered',
      description: '整形済み日付（contract.formattedDate）が DOM テキストに描画される',
      check: ({ root, contract }) =>
        Boolean(contract.formattedDate && root.textContent?.includes(contract.formattedDate)) ||
        `整形済み日付 "${contract.formattedDate}" が描画されていない`,
    },
    {
      id: 'self-identifies',
      description: '契約が EntryCardContent として自己同定する',
      check: ({ contract }) =>
        contract.unit === 'EntryCardContent' || `unit 契約不一致: contract.unit="${contract.unit}"`,
    },
  ],
});
