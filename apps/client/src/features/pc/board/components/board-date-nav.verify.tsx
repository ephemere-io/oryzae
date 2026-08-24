/**
 * BoardDateNav の検証スペック（A 移植）。
 * ボード上部の日付ナビ（‹ ラベル ›）＋表示単位のセグメント切り替え（Daily/Weekly）。
 * 日付も表示単位も親が制御する（dateKey/viewType + onDateChange/onViewTypeChange）ため、
 * BoardDateNav 単体ではクリックしても自身の DOM は変わらない。そこで board-view.tsx と
 * 同じ使い方（useState で保持し setter を渡す）の極小ホストで包み、act のクリックが実際に
 * ラベルを前後に進め、表示単位も切り替わることまで検証する（kind: 'feature'）。
 * verifyAttrs は BoardDateNav の root に付いたままなので、契約（dateKey/viewType/label）が
 * クリックで進む。i18n（board.date.*）は withVerifyProviders が供給。
 *
 * 矢印は data-verify-nav="prev"/"next" で一意に取る。セグメント切り替えが同じ root に
 * 同居して以降、`button` の並び順（最後＝›）で取ると Weekly を押してしまうため。
 */

import { registerUnit } from '@oryzae/verify';
import { useState } from 'react';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { BoardDateNav } from './board-date-nav';

interface Props {
  initialDateKey: string;
  initialViewType: 'daily' | 'weekly';
}

const DAY_NAMES_JA = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];

const NEXT_BTN = 'button[data-verify-nav="next"]';
const WEEKLY_BTN = 'button[data-verify-view-option="weekly"]';

function BoardDateNavHost({ initialDateKey, initialViewType }: Props) {
  const [dateKey, setDateKey] = useState(initialDateKey);
  const [viewType, setViewType] = useState(initialViewType);
  return (
    <BoardDateNav
      dateKey={dateKey}
      viewType={viewType}
      onDateChange={setDateKey}
      onViewTypeChange={setViewType}
    />
  );
}

registerUnit<Props>({
  id: 'BoardDateNav',
  title: 'BoardDateNav',
  description:
    'ボード上部の日付ナビ。‹ › で日（daily）/週（weekly）単位に前後移動し、表示単位も切り替える。',
  kind: 'feature',
  render: (props) => withVerifyProviders(<BoardDateNavHost {...props} />),
  fixtures: [
    {
      id: 'daily',
      description: '日表示。2026-06-24（水曜日）のラベルを表示する',
      props: { initialDateKey: '2026-06-24', initialViewType: 'daily' },
    },
    {
      id: 'daily-next',
      description: '日表示で › を押すと翌日（2026-06-25 木曜日）に進む',
      props: { initialDateKey: '2026-06-24', initialViewType: 'daily' },
      act: async (ctx) => {
        await ctx.click(NEXT_BTN);
        await ctx.wait(16);
      },
    },
    {
      id: 'weekly',
      description: '週表示。2026-06-28（日曜日）を含む週の月→日レンジを表示する',
      props: { initialDateKey: '2026-06-28', initialViewType: 'weekly' },
    },
    {
      id: 'switch-to-weekly',
      description: 'Weekly セグメントを押すと契約が weekly に変わり、ラベルが週レンジになる',
      props: { initialDateKey: '2026-06-28', initialViewType: 'daily' },
      act: async (ctx) => {
        await ctx.click(WEEKLY_BTN);
        await ctx.wait(16);
      },
    },
    {
      id: 'weekly-sunday',
      probe: true,
      description:
        'Probe: dateKey が日曜日（getDay()===0）でも weekRange の Sunday 分岐（-6）が効き、レンジは月→日（2026-06-22 — 2026-06-28）に収まる',
      props: { initialDateKey: '2026-06-28', initialViewType: 'weekly' },
    },
  ],
  invariants: [
    {
      id: 'viewtype-contract-matches-pressed-segment',
      description: 'data-verify-view-type と aria-pressed のセグメントがちょうど1つ対応する',
      check: ({ root, contract }) => {
        const pressed = Array.from(root.querySelectorAll('button[aria-pressed="true"]')).map((b) =>
          b.getAttribute('data-verify-view-option'),
        );
        return (
          (pressed.length === 1 && pressed[0] === contract.viewType) ||
          `セグメント不一致: contract.viewType=${contract.viewType} → pressed=[${pressed.join(', ')}]`
        );
      },
    },
    {
      id: 'daily-label-ends-with-weekday',
      description: '日表示のラベルは "YYYY.MM.DD — <曜日>" 形式で、dateKey の曜日で終わる',
      onlyFixtures: ['daily'],
      check: ({ contract }) => {
        const d = new Date(`${contract.dateKey}T00:00:00`);
        const expectedDay = DAY_NAMES_JA[d.getDay()];
        const dotted = contract.dateKey.replace(/-/g, '.');
        const expected = `${dotted} — ${expectedDay}`;
        return (
          contract.label === expected || `daily label 不一致: "${contract.label}" ≠ "${expected}"`
        );
      },
    },
    {
      id: 'weekly-label-is-monday-to-sunday',
      description: '週表示のラベルは "YYYY.MM.DD — YYYY.MM.DD" で、開始は月曜・終了は日曜（7日差）',
      onlyFixtures: ['weekly', 'weekly-sunday', 'switch-to-weekly'],
      check: ({ contract }) => {
        const m = contract.label.match(/^(\d{4})\.(\d{2})\.(\d{2}) — (\d{4})\.(\d{2})\.(\d{2})$/);
        if (!m) return `weekly label 形式不一致: "${contract.label}"`;
        const start = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00`);
        const end = new Date(`${m[4]}-${m[5]}-${m[6]}T00:00:00`);
        const isMonday = start.getDay() === 1;
        const isSunday = end.getDay() === 0;
        const diffDays = (end.getTime() - start.getTime()) / 86_400_000;
        return (
          (isMonday && isSunday && diffDays === 6) ||
          `週レンジ不正: start.getDay()=${start.getDay()}, end.getDay()=${end.getDay()}, diff=${diffDays}日`
        );
      },
    },
    {
      id: 'next-advances-one-day',
      description: '› クリック後、daily の dateKey が翌日（+1日）に進む',
      onlyFixtures: ['daily-next'],
      check: ({ contract }) =>
        contract.dateKey === '2026-06-25' ||
        `› クリック後の dateKey が翌日でない: "${contract.dateKey}"（期待 2026-06-25）`,
    },
    {
      id: 'weekly-after-segment-click',
      description: 'Weekly セグメントのクリックで viewType が weekly に変わる（日付は動かない）',
      onlyFixtures: ['switch-to-weekly'],
      check: ({ contract }) =>
        (contract.viewType === 'weekly' && contract.dateKey === '2026-06-28') ||
        `expected weekly/2026-06-28, got viewType=${contract.viewType}, dateKey=${contract.dateKey}`,
    },
  ],
});
