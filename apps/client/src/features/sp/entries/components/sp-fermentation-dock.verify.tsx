/**
 * SpFermentationDock の検証スペック。
 *
 * 見るのは: 覗く段は 1 行、半分で手紙の冒頭・言葉・抜粋、全画面で全部、取得中は骨組み、
 * 無ければ「まだ無い」。段の出し入れは制御 props なので fixture で与える。
 */

import { registerUnit } from '@oryzae/verify';
import { useState } from 'react';
import type { DockDetent } from '@/components/ui/dock-sheet';
import type { FermentationDetail } from '@/features/shared/fermentation/types';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { SpFermentationDock } from './sp-fermentation-dock';

interface Props {
  detent: DockDetent;
  detail: FermentationDetail | null;
  loading: boolean;
}

const NO_JAR_POS = { jarX: null, jarY: null };

function makeDetail(overrides: Partial<FermentationDetail>): FermentationDetail {
  return {
    id: 'ferm-1',
    questionId: 'q-1',
    targetPeriod: '2026-05',
    status: 'completed',
    worksheet: null,
    snippets: [],
    keywords: [],
    letter: null,
    scannedEntries: [],
    ...overrides,
  };
}

function keyword(id: string, text: string) {
  return { id, keyword: text, description: `${text} についての気づき。`, ...NO_JAR_POS };
}

function snippet(id: string, text: string) {
  return {
    id,
    snippetType: 'core' as const,
    originalText: text,
    sourceDate: '2026-05-01T00:00:00.000Z',
    selectionReason: 'この一節を選んだ理由。',
    ...NO_JAR_POS,
  };
}

const FULL = makeDetail({
  keywords: [keyword('k1', '静けさ'), keyword('k2', '余白'), keyword('k3', '手触り')],
  snippets: [
    snippet('s1', '朝の光が差し込む台所で、ゆっくりとコーヒーを淹れる時間が好きだ。'),
    snippet('s2', '目を閉じると色んなことを考えてしまう。'),
    snippet('s3', '服を売るのではなく、その視点を売ること。'),
    snippet('s4', '四つ目の抜粋。全画面でだけ出る。'),
  ],
  letter: {
    id: 'l1',
    bodyText: 'あなたの言葉から、静かな強さを感じました。'.repeat(8),
    ...NO_JAR_POS,
  },
});

function Harness(props: Props) {
  const [detent, setDetent] = useState<DockDetent>(props.detent);
  return (
    <div
      style={{
        position: 'relative',
        width: 390,
        height: 700,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ flex: 1 }} />
      <SpFermentationDock
        open
        detent={detent}
        onDetentChange={setDetent}
        questionText="自分は人生をどのように肯定するのだろう"
        detail={props.detail}
        loading={props.loading}
      />
    </div>
  );
}

registerUnit<Props>({
  id: 'SpFermentationDock',
  title: 'SpFermentationDock',
  description: '発酵の結果を見ながら書くためのドック（覗く／半分／全画面）',
  kind: 'component',
  render: (props) => withVerifyProviders(<Harness {...props} />),
  fixtures: [
    {
      id: 'peek',
      description: '覗く段（1 行）',
      props: { detent: 'peek', detail: FULL, loading: false },
    },
    {
      id: 'half',
      description: '半分（手紙の冒頭・言葉・抜粋 3 件）',
      props: { detent: 'half', detail: FULL, loading: false },
    },
    {
      id: 'full',
      description: '全画面（全文・抜粋 4 件）',
      props: { detent: 'full', detail: FULL, loading: false },
    },
    {
      id: 'loading',
      description: '取得中は骨組み',
      props: { detent: 'half', detail: null, loading: true },
    },
    {
      id: 'empty',
      probe: true,
      description: 'Probe: 結果が無ければ「まだ無い」だけ（行き止まりにしない）',
      props: { detent: 'half', detail: makeDetail({}), loading: false },
    },
    {
      id: 'peek-tap-opens',
      probe: true,
      description: 'Probe: 覗く段を押すと半分へ',
      props: { detent: 'peek', detail: FULL, loading: false },
      act: async (ctx) => {
        await ctx.click('[data-dock-peek]');
        await ctx.wait(16);
      },
    },
  ],
  invariants: [
    {
      id: 'snippets-all-listed',
      description: '抜粋は段に関わらず全部並ぶ（段で中身の高さを変えない）',
      check: ({ root, contract }) => {
        const items = root.querySelectorAll('[data-reading-item="snippet"]').length;
        return (
          items === Number(contract.snippetCount) ||
          `抜粋 ${items} 件（契約 ${contract.snippetCount}）`
        );
      },
    },
    {
      id: 'skeleton-while-loading',
      description: '取得中は骨組みが出る',
      onlyFixtures: ['loading'],
      check: ({ root }) => root.querySelectorAll('.animate-pulse').length > 0 || '骨組みが無い',
    },
    {
      id: 'peek-tap-goes-half',
      description: '覗く段を押したら半分',
      onlyFixtures: ['peek-tap-opens'],
      check: ({ contract }) => contract.detent === 'half' || `detent=${contract.detent}`,
    },
  ],
});
