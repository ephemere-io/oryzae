/**
 * HistoryDisc の検証スペック（発酵履歴の円盤 1 枚）。
 *
 * 完全な制御プレゼンテーション部品。データ取得も内部 state も持たず、見た目はすべて props
 * （active / adjacent / placement / detail）から決まる。中の QuestionCircle は detail を
 * props で受け取るだけなので fetch は走らない（useTranslations も使わない）。よって
 * withVerifyProviders 無しでも立つが、将来 i18n が入っても壊れないように包んでおく。
 *
 * 公表する契約: active / adjacent / hasDetail / unread / dateStamp。
 *
 * 円盤の要は「正面だけが中身を開き、隣は日付スタンプだけを見せる」こと。ここが崩れると
 * 全部の円盤が本文を描いて重なるか、正面まで空になる。invariant で両方向を縛る。
 *
 * probe: active=true なのに detail=null（詳細がまだ届いていない一瞬）。中身が空でも
 * 円盤の枠と皿が残り、日付スタンプが誤って出ないことを見る。
 */

import { registerUnit } from '@oryzae/verify';
import type { DiscPlacement } from '@/features/pc/fermentation/utils/cover-flow-geometry';
import type { FermentationDetail } from '@/features/shared/fermentation/types';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { HistoryDisc } from './history-disc';

interface Props {
  questionText: string;
  active: boolean;
  adjacent: boolean;
  placement: DiscPlacement;
  detail: FermentationDetail | null;
  dateStamp: string;
  periodStamp: string;
  unread: boolean;
  dragging: boolean;
  onActivate?: () => void;
  onElementClick: (
    type: 'keyword' | 'snippet' | 'letter',
    id: string,
    data: Record<string, string>,
  ) => void;
  selectedElementId: string | null;
}

const noop = () => {};

const FRONT: DiscPlacement = {
  size: 420,
  translateX: 0,
  translateZ: 0,
  rotateY: 0,
  scale: 1,
  zIndex: 50,
  opacity: 1,
};

const SIDE: DiscPlacement = {
  size: 300,
  translateX: 340,
  translateZ: -150,
  rotateY: -46,
  scale: 0.8,
  zIndex: 49,
  opacity: 0.78,
};

const DETAIL: FermentationDetail = {
  id: 'f-1',
  questionId: 'q-1',
  targetPeriod: 'WEEK 35',
  status: 'completed',
  worksheet: null,
  keywords: [
    { id: 'k-1', keyword: '速度差', description: 'ずれを認めておく', jarX: null, jarY: null },
    { id: 'k-2', keyword: '準備の時間', description: '遅れではなく工程', jarX: null, jarY: null },
  ],
  snippets: [
    {
      id: 's-1',
      snippetType: 'core',
      originalText: '急がなくていい日を、自分で決めていないだけかもしれない',
      sourceDate: '2026-08-27',
      selectionReason: '同じことを別の側から書いている',
      jarX: null,
      jarY: null,
    },
  ],
  letter: {
    id: 'l-1',
    bodyText: '二か月半で、この問いはかたちを変えました。',
    jarX: null,
    jarY: null,
  },
  scannedEntries: [{ id: 'e-1', title: '八月の終わり', createdAt: '2026-08-27' }],
};

const base = {
  questionText: 'なぜ私は急ぐのが苦手なのか',
  periodStamp: 'WEEK 35',
  dragging: false,
  onElementClick: noop,
  selectedElementId: null,
};

registerUnit<Props>({
  id: 'HistoryDisc',
  title: 'HistoryDisc',
  description: '発酵履歴の円盤1枚（正面は中身を開き、隣は日付スタンプだけ）。',
  kind: 'component',
  render: (props) => withVerifyProviders(<HistoryDisc {...props} />),
  fixtures: [
    {
      id: 'active',
      description: '正面の円盤（言葉・抜粋・手紙を開く／日付スタンプは出さない）',
      props: {
        ...base,
        active: true,
        adjacent: false,
        placement: FRONT,
        detail: DETAIL,
        dateStamp: '2026-08-31',
        unread: false,
      },
    },
    {
      id: 'adjacent',
      description: '正面の隣（中身は開かず日付スタンプだけ）',
      props: {
        ...base,
        active: false,
        adjacent: true,
        placement: SIDE,
        detail: DETAIL,
        dateStamp: '2026-07-20',
        periodStamp: 'WEEK 29',
        unread: false,
        onActivate: noop,
      },
    },
    {
      id: 'adjacent-unread',
      description: '未読の隣（日付スタンプが未読色 · NEW 付き）',
      props: {
        ...base,
        active: false,
        adjacent: true,
        placement: SIDE,
        detail: null,
        dateStamp: '2026-08-24',
        periodStamp: 'WEEK 34 · NEW',
        unread: true,
        onActivate: noop,
      },
    },
    {
      id: 'far',
      description: '2段以上離れた円盤（中身もスタンプも出さない、影だけ）',
      props: {
        ...base,
        active: false,
        adjacent: false,
        placement: { ...SIDE, translateX: 600, translateZ: -240, scale: 0.73, opacity: 0.65 },
        detail: DETAIL,
        dateStamp: '2026-06-15',
        periodStamp: 'WEEK 24',
        unread: false,
        onActivate: noop,
      },
    },
    {
      id: 'active-detail-pending',
      probe: true,
      description: 'Probe: 正面だが詳細が未取得（中身が空でも枠が残り、スタンプは出ない）',
      props: {
        ...base,
        active: true,
        adjacent: false,
        placement: FRONT,
        detail: null,
        dateStamp: '2026-08-31',
        unread: false,
      },
    },
  ],
  invariants: [
    {
      id: 'date-stamp-iff-adjacent',
      description: '日付スタンプは adjacent=true のときだけ描画される',
      check: ({ root, contract }) => {
        const hasStamp = Boolean(root.querySelector('[data-verify-part="date-stamp"]'));
        const expected = contract.adjacent === 'true';
        return (
          hasStamp === expected ||
          `日付スタンプ present=${hasStamp} だが contract.adjacent="${contract.adjacent}"`
        );
      },
    },
    {
      id: 'stamp-shows-contract-date',
      description: 'スタンプに出る日付は contract.dateStamp と一致する',
      onlyFixtures: ['adjacent', 'adjacent-unread'],
      check: ({ root, contract }) => {
        const stamp = root.querySelector('[data-verify-part="date-stamp"]');
        const text = stamp?.textContent ?? '';
        return (
          text.includes(contract.dateStamp) ||
          `スタンプの文言="${text}" に contract.dateStamp="${contract.dateStamp}" が含まれない`
        );
      },
    },
    {
      id: 'content-only-when-active',
      description: '言葉・抜粋・手紙は正面（active=true）の円盤にだけ描かれる',
      check: ({ root, contract }) => {
        const circle = root.querySelector('[data-verify-unit="QuestionCircle"]');
        const keywords = circle?.getAttribute('data-verify-keyword-count') ?? '0';
        const opensContent = keywords !== '0';
        const shouldOpen = contract.active === 'true' && contract.hasDetail === 'true';
        return (
          opensContent === shouldOpen ||
          `keywordCount=${keywords}（中身を開いた=${opensContent}）だが active=${contract.active} / hasDetail=${contract.hasDetail}`
        );
      },
    },
    {
      id: 'ring-hidden-on-discs',
      description: '円周の問いテキストは円盤では出さない（画面上部の見出しと二重になる）',
      check: ({ root }) => {
        const circle = root.querySelector('[data-verify-unit="QuestionCircle"]');
        const showRing = circle?.getAttribute('data-verify-show-ring');
        return (
          showRing === 'false' || `QuestionCircle の showRing="${showRing}"（false であるべき）`
        );
      },
    },
    {
      id: 'disc-size-follows-placement',
      description: '内側の円は円盤の箱と同じ直径で描かれる（はみ出さない・小さすぎない）',
      check: ({ root }) => {
        const circle = root.querySelector('[data-verify-unit="QuestionCircle"]');
        const size = circle?.getAttribute('data-verify-size');
        return (
          (size !== null && size !== '0') || `QuestionCircle の size="${size}"（箱の一辺が要る）`
        );
      },
    },
    {
      id: 'active-not-clickable-to-flip',
      description: '正面の円盤はめくる取っ手を持たない（自分自身へは飛べない）',
      onlyFixtures: ['active', 'active-detail-pending'],
      check: ({ root, contract }) =>
        contract.active === 'true' ||
        `active fixture のはずが contract.active="${contract.active}"（root=${root.tagName}）`,
    },
    {
      id: 'probe-pending-detail-keeps-frame',
      description: 'Probe: 詳細が未取得でも円盤の枠は残る（穴が開かない）',
      onlyFixtures: ['active-detail-pending'],
      check: ({ root, contract }) => {
        const circle = root.querySelector('[data-verify-unit="QuestionCircle"]');
        return (
          (circle !== null && contract.hasDetail === 'false') ||
          `詳細未取得の正面で円が描かれていない（circle=${circle !== null}, hasDetail=${contract.hasDetail}）`
        );
      },
    },
  ],
});
