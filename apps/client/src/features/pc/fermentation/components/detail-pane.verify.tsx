/**
 * DetailPane の検証スペック（A 移植・発酵瓶の詳細パネル）。
 *
 * 完全な制御プレゼンテーション部品。データ取得・内部 state を持たず、状態はすべて props
 * （open / type / data）から決まる。useRouter / useTranslations はどちらも withVerifyProviders
 * が供給するため、props を渡すだけで fetch ゼロの孤立検証ができる（covered）。
 *
 * この面は null を返さない（visible=false でも DOM に残り、幅 0 へ畳む）。よって
 * visible/open どちらの false も有効な fixture で、契約は常に読める。
 *
 * 状態が 2 段ある。`visible` は **列そのもの**（円を開いている / 履歴を見ている間ずっと）、
 * `open` は **中身が選ばれているか**。選ぶたびに列が出入りすると隣のキャンバス列の幅が
 * 変わって円が動くので、この 2 つは分けてある。invariant はその分離を縛る。
 *
 * 幅は種類で変えない。言葉・抜粋・手紙を渡り歩くのが主な使われ方なので、種類ごとに
 * 変えると選ぶたびに円が動く。
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
  visible: boolean;
  open: boolean;
  onClose: () => void;
  questionId: string;
  contextLabel: string;
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
        visible: true,
        open: true,
        onClose: noop,
        questionId: 'q-1',
        contextLabel: '2026-06-28 の発酵',
        type: 'keyword',
        data: { keyword: '焙煎', description: '香りが立つ瞬間の話。' },
      },
    },
    {
      id: 'snippet-open',
      description: '開いていてスニペット詳細を表示（引用 + 出典 + 選定理由）',
      props: {
        visible: true,
        open: true,
        onClose: noop,
        questionId: 'q-2',
        contextLabel: '2026-05-10 の発酵',
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
        visible: true,
        open: true,
        onClose: noop,
        questionId: 'q-3',
        contextLabel: '2026-06-28 の発酵',
        type: 'letter',
        data: { bodyText: '一行目\n二行目' },
      },
    },
    {
      id: 'closed',
      description: '列は出ているが未選択（type/data が残っていても本文は出さない）',
      props: {
        visible: true,
        open: false,
        onClose: noop,
        questionId: 'q-1',
        contextLabel: '2026-06-28 の発酵',
        type: 'keyword',
        data: { keyword: '焙煎', description: '香りが立つ瞬間の話。' },
      },
    },
    {
      id: 'column-empty',
      description: '列は出ているが中身は未選択（空状態の案内が出る）',
      props: {
        visible: true,
        open: false,
        onClose: noop,
        questionId: 'q-1',
        contextLabel: '2026-06-28 の発酵',
        type: null,
        data: null,
      },
    },
    {
      id: 'column-collapsed',
      probe: true,
      description: 'Probe: 問いの中に居ない（列ごと幅 0 に畳む。キャンバスが全幅に戻る）',
      props: {
        visible: false,
        open: false,
        onClose: noop,
        questionId: 'q-1',
        contextLabel: '2026-06-28 の発酵',
        type: null,
        data: null,
      },
    },
    {
      id: 'keyword-no-data',
      probe: true,
      description: 'Probe: type=keyword でも data=null なら本文ブロックを描かない（crash しない）',
      props: {
        visible: true,
        open: true,
        onClose: noop,
        questionId: 'q-1',
        contextLabel: '2026-06-28 の発酵',
        type: 'keyword',
        data: null,
      },
    },
  ],
  invariants: [
    {
      id: 'column-width-follows-visible',
      description: '列の幅は contract.visible で決まる（畳むと 0、開くと固定幅）',
      check: ({ root, contract }) => {
        const el = root.querySelector<HTMLElement>('[data-verify-unit="DetailPane"]');
        const width = Number.parseInt(el?.style.width ?? '', 10);
        const expected = contract.visible === 'true' ? Number(contract.width) : 0;
        return (
          width === expected ||
          `visible="${contract.visible}" では幅 ${expected} を期待したが ${width}`
        );
      },
    },
    {
      id: 'width-does-not-follow-content-type',
      description:
        '幅は中身の種類で変わらない（渡り歩くたびに隣のキャンバス列が伸び縮みしない）。変えるのは人が掴んだときだけ',
      check: ({ contract }) =>
        contract.width === '480' ||
        `type="${contract.type}" で width=${contract.width}（種類に依らず既定の 480 であるべき）`,
    },
    {
      id: 'resize-handle-is-a-labelled-separator',
      description: '幅の取っ手は名前を持つ separator で、キーボードでも掴める',
      check: ({ root, contract }) => {
        const handle = root.querySelector<HTMLElement>('[data-verify-part="resize-handle"]');
        if (!handle) return '幅の取っ手が描画されていない（リサイズ不可）';
        if (contract.visible !== 'true') {
          // 畳んでいる間は置いたまま不活性にする（描画ごと消すと suppression が外れる）。
          const inert = handle.style.pointerEvents === 'none' && handle.tabIndex === -1;
          return (
            inert || `畳んだ列の取っ手が生きている（pointerEvents=${handle.style.pointerEvents}）`
          );
        }
        const role = handle.getAttribute('role');
        const label = handle.getAttribute('aria-label');
        const focusable = handle.getAttribute('tabindex') === '0';
        const now = Number(handle.getAttribute('aria-valuenow'));
        const min = Number(handle.getAttribute('aria-valuemin'));
        const max = Number(handle.getAttribute('aria-valuemax'));
        if (!(role === 'separator' && label && focusable)) {
          return `role=${role}, aria-label=${label}, tabindex=${handle.getAttribute('tabindex')}`;
        }
        if (now !== Number(contract.width)) {
          return `aria-valuenow=${now} が契約 width=${contract.width} と違う`;
        }
        return (now >= min && now <= max) || `width=${now} が範囲 [${min}, ${max}] の外`;
      },
    },
    {
      id: 'empty-state-iff-not-open',
      description: '中身が未選択なら空状態を出す。選ばれていれば本文を出す',
      check: ({ root, contract }) => {
        const hasEmpty = Boolean(root.querySelector('[data-verify-part="empty"]'));
        const expectEmpty = contract.open === 'false';
        return (
          hasEmpty === expectEmpty ||
          `空状態 present=${hasEmpty} だが contract.open="${contract.open}"`
        );
      },
    },
    {
      id: 'no-question-in-the-column',
      description: '問いはこの列に出さない（円周・上部の見出しと合わせて 3 か所に重なっていた）',
      check: ({ root, props, contract }) => {
        const context = root.querySelector('[data-verify-part="context"]');
        const text = context?.textContent ?? '';
        // 中身を選んでいないときは本文ごと描かないので、この行も出ない。
        const shouldShow = contract.open === 'true' && props.contextLabel !== '';
        return (
          (shouldShow ? text === props.contextLabel : context === null) ||
          `context="${text}" だが open=${contract.open} / props.contextLabel="${props.contextLabel}"`
        );
      },
    },
    {
      id: 'body-block-matches-type',
      description:
        '中身を選んでいるとき、本文ブロックは契約 type と一致する（keyword→h3 / snippet→blockquote / letter→whitespace-pre-wrap。未選択・data 無しは描かない）',
      check: ({ root, contract }) => {
        // 中身を選んでいないときは本文を出さない（列は空状態を見せる）。type/data が
        // 前の選択のまま残っていても、それを描いてはいけない。
        const isOpen = contract.open === 'true';
        const hasData = isOpen && contract.hasData === 'true';
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
      id: 'cta-present-when-open',
      description: '中身を選んでいるときだけ取っ手（× と「エントリを書く」）が出る',
      check: ({ root, contract }) => {
        const buttons = Array.from(root.querySelectorAll('button'));
        if (contract.open !== 'true') {
          // 未選択のときは取っ手を出さない（押せるものが無い列に × だけ残さない）。
          return buttons.length === 0 || `未選択なのに button が ${buttons.length} 個ある`;
        }
        // close(×) + write-entry の 2 つ。
        return (
          buttons.length === 2 || `button数=${buttons.length}（close + write-entry の2つを期待）`
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
