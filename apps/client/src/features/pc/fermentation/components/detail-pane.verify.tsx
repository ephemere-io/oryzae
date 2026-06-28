/**
 * DetailPane の検証スペック（A 移植・発酵瓶の詳細パネル）。
 *
 * 完全な制御プレゼンテーション部品。データ取得・内部 state を持たず、状態はすべて props
 * （open / type / data）から決まる。useRouter / useTranslations はどちらも withVerifyProviders
 * が供給するため、props を渡すだけで fetch ゼロの孤立検証ができる（covered）。
 *
 * このパネルは null を返さない（open=false でも DOM に残り `right: -400` で画面外へスライドする）。
 * よって open=false も有効な fixture で、契約 `open` は常に読める。スライド位置は React が
 * `right:0` を `'0'`（px 無し）で描くため `=== '0px'` 比較は脆い。Number.parseInt の符号で判定する。
 *
 * 契約 `type`（keyword/snippet/letter/none）が本文ブロックの discriminator。verifyAttrs は
 * null を落とすため type=null は 'none' に正規化して常に読めるようにしている。
 * 本文テキストの assert はハードコード i18n ではなく、fixture で渡した data 値（keyword/
 * originalText/bodyText）に対して行い、翻訳変更で壊れないようにする。
 *
 * probe: type='keyword' に data=null を渡し、`type === 'x' && data` ガードで本文が空になる
 * （crash しない）敵対的エッジを突く。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { DetailPane } from './detail-pane';

interface Props {
  open: boolean;
  onClose: () => void;
  questionId: string;
  questionText: string;
  type: 'keyword' | 'snippet' | 'letter' | null;
  data: {
    keyword?: string;
    description?: string;
    originalText?: string;
    sourceDate?: string;
    selectionReason?: string;
    bodyText?: string;
  } | null;
}

const noop = () => {};

registerUnit<Props>({
  id: 'DetailPane',
  title: 'DetailPane',
  description: '発酵瓶の詳細パネル（キーワード/スニペット/レター本文 + エントリ作成 CTA）。',
  kind: 'component',
  render: (props) => withVerifyProviders(<DetailPane {...props} />),
  fixtures: [
    {
      id: 'keyword-open',
      description: '開いていてキーワード詳細を表示（h3 にキーワード、本文に説明）',
      props: {
        open: true,
        onClose: noop,
        questionId: 'q-1',
        questionText: '最近うれしかったことは？',
        type: 'keyword',
        data: { keyword: '焙煎', description: '香りが立つ瞬間の話。' },
      },
    },
    {
      id: 'snippet-open',
      description: '開いていてスニペット詳細を表示（引用 + 出典 + 選定理由）',
      props: {
        open: true,
        onClose: noop,
        questionId: 'q-2',
        questionText: 'いま気がかりなことは？',
        type: 'snippet',
        data: {
          originalText: '朝のコーヒーが沁みた',
          sourceDate: '2026-06-01',
          selectionReason: '静かな喜びが滲んでいたため。',
        },
      },
    },
    {
      id: 'letter-open',
      description: '開いていてレター（観察記録）本文を表示',
      props: {
        open: true,
        onClose: noop,
        questionId: 'q-3',
        questionText: '今日のあなたへ',
        type: 'letter',
        data: { bodyText: '一行目\n二行目' },
      },
    },
    {
      id: 'closed',
      description: '閉じている（type=keyword でも画面外へスライドして待機する）',
      props: {
        open: false,
        onClose: noop,
        questionId: 'q-1',
        questionText: '最近うれしかったことは？',
        type: 'keyword',
        data: { keyword: '焙煎', description: '香りが立つ瞬間の話。' },
      },
    },
    {
      id: 'keyword-no-data',
      probe: true,
      description: 'Probe: type=keyword でも data=null なら本文ブロックを描かない（crash しない）',
      props: {
        open: true,
        onClose: noop,
        questionId: 'q-1',
        questionText: '最近うれしかったことは？',
        type: 'keyword',
        data: null,
      },
    },
  ],
  invariants: [
    {
      id: 'slide-position-reflects-open',
      description: '契約 open=true なら right>=0（表示）、false なら right<0（画面外）',
      check: ({ root, contract }) => {
        const el = root.querySelector<HTMLElement>('[data-verify-unit="DetailPane"]');
        const right = Number.parseInt(el?.style.right ?? '', 10);
        const isOpen = contract.open === 'true';
        const onScreen = right >= 0;
        return (
          isOpen === onScreen ||
          `contract.open="${contract.open}" だが style.right="${el?.style.right}"（parseInt=${right}）`
        );
      },
    },
    {
      id: 'body-block-matches-type',
      description:
        '本文ブロックは契約 type と一致する（keyword→h3 / snippet→blockquote / letter→whitespace-pre-wrap、data 無しは描かない）',
      check: ({ root, contract }) => {
        const hasData = contract.hasData === 'true';
        const hasKeyword = Boolean(root.querySelector('h3'));
        const hasSnippet = Boolean(root.querySelector('blockquote'));
        const hasLetter = Boolean(root.querySelector('.whitespace-pre-wrap'));
        const expectKeyword = hasData && contract.type === 'keyword';
        const expectSnippet = hasData && contract.type === 'snippet';
        const expectLetter = hasData && contract.type === 'letter';
        return (
          (hasKeyword === expectKeyword &&
            hasSnippet === expectSnippet &&
            hasLetter === expectLetter) ||
          `block/type 不一致: type="${contract.type}" hasData=${contract.hasData} / keyword=${hasKeyword} snippet=${hasSnippet} letter=${hasLetter}`
        );
      },
    },
    {
      id: 'question-and-cta-always-present',
      description: '問い文と「エントリを書く」CTA は open/type/data に依らず常に描画される',
      check: ({ root, props }) => {
        const text = root.textContent ?? '';
        const hasQuestion = text.includes(props.questionText);
        const buttons = Array.from(root.querySelectorAll('button'));
        const hasCta = buttons.length === 2;
        return (
          (hasQuestion && hasCta) ||
          `問い文 present=${hasQuestion} / button数=${buttons.length}（close + write-entry の2つを期待）`
        );
      },
    },
    {
      id: 'keyword-data-rendered',
      description: 'keyword 表示時は渡した keyword/description が本文に出る',
      onlyFixtures: ['keyword-open'],
      check: ({ root, props }) => {
        const text = root.textContent ?? '';
        const kw = props.data?.keyword ?? '';
        const desc = props.data?.description ?? '';
        return (
          (text.includes(kw) && text.includes(desc)) ||
          `keyword="${kw}" / description="${desc}" が本文に描画されていない`
        );
      },
    },
    {
      id: 'snippet-data-rendered',
      description: 'snippet 表示時は渡した originalText/selectionReason が本文に出る',
      onlyFixtures: ['snippet-open'],
      check: ({ root, props }) => {
        const text = root.textContent ?? '';
        const quote = props.data?.originalText ?? '';
        const reason = props.data?.selectionReason ?? '';
        return (
          (text.includes(quote) && text.includes(reason)) ||
          `originalText="${quote}" / selectionReason="${reason}" が本文に描画されていない`
        );
      },
    },
    {
      id: 'letter-data-rendered',
      description: 'letter 表示時は渡した bodyText が whitespace-pre-wrap で出る',
      onlyFixtures: ['letter-open'],
      check: ({ root, props }) => {
        const block = root.querySelector('.whitespace-pre-wrap');
        const body = props.data?.bodyText ?? '';
        return (
          Boolean(block?.textContent?.includes(body)) ||
          `bodyText="${body}" が whitespace-pre-wrap ブロックに描画されていない`
        );
      },
    },
    {
      id: 'no-body-when-data-null',
      description: 'data=null のときは type が立っていても本文ブロックを描かない（probe）',
      onlyFixtures: ['keyword-no-data'],
      check: ({ root }) => {
        const hasAnyBlock = Boolean(
          root.querySelector('h3') ||
            root.querySelector('blockquote') ||
            root.querySelector('.whitespace-pre-wrap'),
        );
        return !hasAnyBlock || 'data=null なのに本文ブロックが描画された';
      },
    },
  ],
});
