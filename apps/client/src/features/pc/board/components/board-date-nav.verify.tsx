/**
 * BoardDateNav の検証スペック（A 移植）。
 * ボード左上の日付ナビ（‹ ラベル ›）。日付は親が制御する（dateKey + onDateChange）ため、
 * BoardDateNav 単体ではクリックしても自身の DOM は変わらない。そこで board-view.tsx と
 * 同じ使い方（useState で dateKey を保持し setDateKey を onDateChange に渡す）の極小ホストで
 * 包み、act のクリックが実際にラベルを前後に進めることまで検証する（kind: 'feature'）。
 * verifyAttrs は BoardDateNav の root に付いたままなので、契約（dateKey/viewType/label）が
 * クリックで進む。i18n（board.date.*）は withVerifyProviders が供給。
 *
 * viewType は表示（ラベル形式と送り幅）にだけ効く props で、切り替え UI は右上の
 * BoardViewSwitch が持つ。ここでは props として固定して両方の見え方を確認する。
 * 矢印は data-verify-nav="prev"/"next" で一意に取る。
 */

import { registerUnit } from '@oryzae/verify';
import { useState } from 'react';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { BoardDateNav } from './board-date-nav';

interface Props {
  initialDateKey: string;
  viewType: 'daily' | 'weekly';
}

const DAY_NAMES_JA = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];

const PREV_BTN = 'button[data-verify-nav="prev"]';
const NEXT_BTN = 'button[data-verify-nav="next"]';

function BoardDateNavHost({ initialDateKey, viewType }: Props) {
  const [dateKey, setDateKey] = useState(initialDateKey);
  return <BoardDateNav dateKey={dateKey} viewType={viewType} onDateChange={setDateKey} />;
}

registerUnit<Props>({
  id: 'BoardDateNav',
  title: 'BoardDateNav',
  description: 'ボード左上の日付ナビ。‹ › で日（daily）/週（weekly）単位に前後移動する。',
  kind: 'feature',
  render: (props) => withVerifyProviders(<BoardDateNavHost {...props} />),
  fixtures: [
    {
      id: 'daily',
      description: '日表示。2026-06-24（水曜日）のラベルを表示する',
      props: { initialDateKey: '2026-06-24', viewType: 'daily' },
    },
    {
      id: 'daily-next',
      description: '日表示で › を押すと翌日（2026-06-25 木曜日）に進む',
      props: { initialDateKey: '2026-06-24', viewType: 'daily' },
      act: async (ctx) => {
        await ctx.click(NEXT_BTN);
        await ctx.wait(16);
      },
    },
    {
      id: 'weekly',
      description: '週表示。2026-06-28（日曜日）を含む週の月→日レンジを表示する',
      props: { initialDateKey: '2026-06-28', viewType: 'weekly' },
    },
    {
      id: 'weekly-prev',
      description: '週表示で ‹ を押すと7日戻る（前の週のレンジになる）',
      props: { initialDateKey: '2026-06-28', viewType: 'weekly' },
      act: async (ctx) => {
        await ctx.click(PREV_BTN);
        await ctx.wait(16);
      },
    },
    {
      id: 'weekly-sunday',
      probe: true,
      description:
        'Probe: dateKey が日曜日（getDay()===0）でも weekRange の Sunday 分岐（-6）が効き、レンジは月→日（2026-06-22 — 2026-06-28）に収まる',
      props: { initialDateKey: '2026-06-28', viewType: 'weekly' },
    },
  ],
  invariants: [
    {
      id: 'viewtype-contract-matches-props',
      description: 'data-verify-view-type が props.viewType と一致する',
      check: ({ contract, props }) =>
        contract.viewType === props.viewType ||
        `viewType 契約不一致: props.viewType=${props.viewType} → contract.viewType=${contract.viewType}`,
    },
    {
      id: 'no-view-switch-here',
      description: '表示単位の切り替えは持たない（右上の BoardViewSwitch の役目）',
      check: ({ root }) =>
        root.querySelectorAll('[data-verify-view-option]').length === 0 ||
        '日付ナビに表示単位の切り替えが混ざっている',
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
      onlyFixtures: ['weekly', 'weekly-sunday', 'weekly-prev'],
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
      id: 'prev-goes-back-one-week',
      description: '‹ クリック後、weekly の dateKey が7日戻る',
      onlyFixtures: ['weekly-prev'],
      check: ({ contract }) =>
        contract.dateKey === '2026-06-21' ||
        `‹ クリック後の dateKey が7日前でない: "${contract.dateKey}"（期待 2026-06-21）`,
    },
  ],
});
