/**
 * FermentationReading の検証スペック。
 *
 * 見るのは: キーワードの説明とスニペットの理由が最初から並ぶ（押して開く面が無い）、足元の返事は手紙の
 * 書き出しを引く、返事と出典は渡したときだけ出る。
 */

import { registerUnit } from '@oryzae/verify';
import { useState } from 'react';
import type { FermentationDetail } from '@/features/shared/fermentation/types';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { FermentationReading } from './fermentation-reading';

interface Props {
  detail: FermentationDetail;
  withReply: boolean;
  withSources: boolean;
}

const DETAIL: FermentationDetail = {
  id: 'f-1',
  questionId: 'q-1',
  targetPeriod: '2026-06',
  status: 'completed',
  worksheet: null,
  letter: {
    id: 'l-1',
    bodyText:
      'あなたの言葉から、静かな喜びが立ち上っています。雨の日の散歩の記録に、同じ光が三度出てきました。',
    jarX: null,
    jarY: null,
  },
  keywords: [
    {
      id: 'k-1',
      keyword: '記号剥ぎの手つき',
      description: '意味を剥いで、手触りだけを残す。',
      jarX: null,
      jarY: null,
    },
    { id: 'k-2', keyword: '立ち上がる見え方', description: '', jarX: null, jarY: null },
  ],
  snippets: [
    {
      id: 's-1',
      snippetType: 'core',
      originalText: '今もがき苦しんでる私にとってとっても大きな気づきでした。',
      sourceDate: '2026-07-06T00:00:00.000Z',
      selectionReason: '同じ光景が三度出てくる。',
      jarX: null,
      jarY: null,
    },
  ],
  scannedEntries: [{ id: 'e-9', title: '雨の日の散歩', createdAt: '2026-07-01T00:00:00.000Z' }],
};

function Harness({ detail, withReply, withSources }: Props) {
  const [replied, setReplied] = useState(false);
  return (
    <div
      data-replied={replied}
      style={{ width: 390, padding: 20, background: 'var(--surface-raised)' }}
    >
      <FermentationReading
        detail={detail}
        onReply={withReply ? () => setReplied(true) : undefined}
        onOpenSource={withSources ? () => {} : undefined}
      />
    </div>
  );
}

registerUnit<Props>({
  id: 'FermentationReading',
  title: 'FermentationReading',
  description: '発酵の結果を読む縦の流れ（瓶の問いの画面とエントリーの発酵の結果で共通）',
  kind: 'component',
  render: (props) => withVerifyProviders(<Harness {...props} />),
  fixtures: [
    {
      id: 'full',
      description: '手紙・キーワード・スニペット・足元（返事と出典）',
      props: { detail: DETAIL, withReply: true, withSources: true },
    },
    {
      id: 'in-editor',
      description: 'エントリーの中（返事も出典も渡さない）',
      props: { detail: DETAIL, withReply: false, withSources: false },
    },
    {
      id: 'no-letter',
      description: '手紙が無い（足元も出ない）',
      props: { detail: { ...DETAIL, letter: null }, withReply: true, withSources: true },
    },
    {
      id: 'reply',
      probe: true,
      description: 'Probe: 足元の「この手紙に返事を書く」を押す',
      props: { detail: DETAIL, withReply: true, withSources: true },
      act: async (ctx) => {
        await ctx.click('[data-letter-reply]');
        await ctx.wait(16);
      },
    },
  ],
  invariants: [
    {
      id: 'details-inline',
      description: 'キーワードの説明とスニペットの理由が最初から並び、押して開く面が無い',
      check: ({ root, props }) => {
        const text = root.textContent ?? '';
        const described = props.detail.keywords.filter((k) => k.description);
        const missing = [
          ...described.filter((k) => !text.includes(k.description)).map((k) => k.keyword),
          ...props.detail.snippets
            .filter((s) => s.selectionReason && !text.includes(s.selectionReason))
            .map((s) => s.id),
        ];
        const itemButtons = root.querySelectorAll('[data-reading-item] button').length;
        return (
          (missing.length === 0 && itemButtons === 0) ||
          `出ていない: ${missing.join(', ')} / 項目の中のボタン ${itemButtons}`
        );
      },
    },
    {
      id: 'footer-echoes-letter',
      description: '足元は手紙があり返事か出典を渡したときだけ。出すなら手紙の書き出しを引く',
      check: ({ root, props }) => {
        const footer = root.querySelector('[data-letter-footer]');
        const expected = props.detail.letter !== null && (props.withReply || props.withSources);
        if (!expected) return footer === null || '足元が出ている';
        const echo = footer?.querySelector('[data-letter-echo]')?.textContent ?? '';
        const opening = props.detail.letter?.bodyText.slice(0, 10) ?? '';
        return echo.includes(opening) || `手紙の書き出しを引いていない: ${echo}`;
      },
    },
    {
      id: 'reply-pressed',
      description: '返事を押すと呼び出し側に届く',
      onlyFixtures: ['reply'],
      check: ({ root }) =>
        root.querySelector('[data-replied="true"]') !== null || '返事が呼ばれていない',
    },
  ],
});
