/**
 * FermentationOverlayDetailPane の検証スペック。
 * 発酵オーバーレイ上のキーワード／スニペット／レター詳細を表示する、完全に制御された
 * （状態を持たない）スライドインペイン。open/type/data の props を DOM 契約として公表し、
 * 「open↔aria-hidden」「type↔ヘッダ」「data↔本文」の prop↔DOM 一致を invariant で検証する。
 *
 * NOTE: このコンポーネントは fully controlled（open は prop、内部 state なし）。close ボタンは
 * onClose を呼ぶだけで自身の DOM は変化しないため、クリックでの状態遷移は invariant にしない。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import {
  type FermentationOverlayDetailData,
  FermentationOverlayDetailPane,
  type FermentationOverlayDetailType,
} from './fermentation-overlay-detail-pane';

interface Props {
  open: boolean;
  onClose: () => void;
  type: FermentationOverlayDetailType | null;
  data: FermentationOverlayDetailData | null;
}

const UNIT_SELECTOR = '[data-verify-unit="FermentationOverlayDetailPane"]';

const keywordData: FermentationOverlayDetailData = {
  keyword: '静けさ',
  description: 'あなたの言葉に繰り返し現れた、内省を促す中心的なテーマです。',
};

const snippetData: FermentationOverlayDetailData = {
  originalText: '朝の光が差し込む台所で、静かにコーヒーを淹れた。',
  sourceDate: '2026-06-01',
  selectionReason: '日常の小さな所作を丁寧に描写した一節として選びました。',
};

const letterData: FermentationOverlayDetailData = {
  bodyText: '親愛なるあなたへ。\n\nこの一週間、あなたは静けさを大切にしていました。',
};

const noop = () => {};

registerUnit<Props>({
  id: 'FermentationOverlayDetailPane',
  title: 'FermentationOverlayDetailPane',
  description: '発酵オーバーレイの詳細ペイン（キーワード／スニペット／レターをスライドイン表示）',
  kind: 'component',
  render: (props) => withVerifyProviders(<FermentationOverlayDetailPane {...props} />),
  fixtures: [
    {
      id: 'keyword-open',
      description: 'キーワード詳細を開いた状態',
      props: { open: true, onClose: noop, type: 'keyword', data: keywordData },
    },
    {
      id: 'snippet-open',
      description: 'スニペット詳細を開いた状態（出典あり）',
      props: { open: true, onClose: noop, type: 'snippet', data: snippetData },
    },
    {
      id: 'letter-open',
      description: 'レター詳細を開いた状態',
      props: { open: true, onClose: noop, type: 'letter', data: letterData },
    },
    {
      id: 'closed',
      description: '閉じている状態（画面外にスライドアウト・aria-hidden）',
      props: { open: false, onClose: noop, type: 'keyword', data: keywordData },
    },
    {
      id: 'snippet-no-source',
      description: '出典日のないスニペット（任意フィールド欠落でも崩れない）',
      props: {
        open: true,
        onClose: noop,
        type: 'snippet',
        data: {
          originalText: '名もなき一日の記録。',
          selectionReason: '日付メタデータがなくても本文と理由は表示される。',
        },
      },
    },
    {
      id: 'empty',
      probe: true,
      description: 'Probe: open かつ type=null/data=null。ヘッダ空・本文なしでもクラッシュしない',
      props: { open: true, onClose: noop, type: null, data: null },
    },
    {
      id: 'close-click',
      description: 'close ボタンをクリック（controlled なので DOM は不変・クラッシュしないこと）',
      props: { open: true, onClose: noop, type: 'keyword', data: keywordData },
      act: async (ctx) => {
        await ctx.click('button');
        await ctx.wait(16);
      },
    },
  ],
  invariants: [
    {
      id: 'open-matches-aria-hidden',
      description: 'open=true のとき aria-hidden="false"、open=false のとき aria-hidden="true"',
      check: ({ root, contract }) => {
        const el = root.querySelector(UNIT_SELECTOR);
        const ariaHidden = el?.getAttribute('aria-hidden');
        const expected = contract.open === 'true' ? 'false' : 'true';
        return (
          ariaHidden === expected ||
          `aria-hidden="${ariaHidden}" だが contract.open="${contract.open}" → 期待="${expected}"`
        );
      },
    },
    {
      id: 'type-contract-present',
      description: "type 契約は常に存在する（null のときは 'none'）",
      check: ({ contract }) => {
        const allowed = ['keyword', 'snippet', 'letter', 'none'];
        return (
          allowed.includes(contract.type) ||
          `contract.type が不正: "${contract.type}"（許容: ${allowed.join(', ')}）`
        );
      },
    },
    {
      id: 'header-reflects-type',
      description: 'type が設定されていればヘッダは非空、type=none なら本文・ヘッダ領域は空',
      check: ({ root, contract }) => {
        const text = root.textContent ?? '';
        if (contract.type === 'none') {
          // 閉じる(×)ボタン以外に意味のあるテキストが無いこと
          return (
            text.replace(/[×\s]/g, '').length === 0 ||
            `type=none なのに本文テキストが残っている: "${text.trim()}"`
          );
        }
        return text.trim().length > 0 || `type=${contract.type} なのにテキストが描画されていない`;
      },
    },
    {
      id: 'keyword-body-rendered',
      description: 'keyword: data.keyword と description が本文に描画される',
      onlyFixtures: ['keyword-open'],
      check: ({ root, props }) => {
        const text = root.textContent ?? '';
        const kw = props.data?.keyword ?? '';
        const desc = props.data?.description ?? '';
        return (
          (text.includes(kw) && text.includes(desc)) ||
          `keyword 本文未描画: keyword="${kw}", description="${desc}"`
        );
      },
    },
    {
      id: 'snippet-body-rendered',
      description: 'snippet: originalText と selectionReason が本文に描画される',
      onlyFixtures: ['snippet-open', 'snippet-no-source'],
      check: ({ root, props }) => {
        const text = root.textContent ?? '';
        const original = props.data?.originalText ?? '';
        const reason = props.data?.selectionReason ?? '';
        return (
          (text.includes(original) && text.includes(reason)) ||
          `snippet 本文未描画: originalText="${original}", selectionReason="${reason}"`
        );
      },
    },
    {
      id: 'letter-body-rendered',
      description: 'letter: bodyText が本文に描画される',
      onlyFixtures: ['letter-open'],
      check: ({ root, props }) => {
        const text = root.textContent ?? '';
        const body = props.data?.bodyText ?? '';
        return text.includes(body) || `letter 本文未描画: bodyText="${body}"`;
      },
    },
    {
      id: 'unit-stays-mounted',
      description: 'close クリック後もユニットはマウントされたまま（controlled なので DOM 不変）',
      onlyFixtures: ['close-click'],
      check: ({ root }) =>
        Boolean(root.querySelector(UNIT_SELECTOR)) ||
        'close クリック後にユニット要素が消えた（controlled では起きないはず）',
    },
  ],
});
