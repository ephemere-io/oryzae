/**
 * FermentationSidebar の検証スペック（Issue #466）。
 *
 * detail を props で受け取り、手紙・キーワード・スニペットをサイドバーに列挙する部品。
 * データ取得は親（useFermentationForQuestion）が担うので props だけで孤立レンダリングできる。
 *
 * 注意:
 * - **面は1枚**。項目を開いても別の面は生えず、この面の中身が一覧 ⇄ 中身で入れ替わる。
 *   同じ場所に同じ幅の面が2枚重なると、どちらを見ているのか分からなくなるため。
 * - キーワードは 5 件、スニペットは 3 件で slice する。契約は **描画済み（cap 後）** の件数を
 *   公表するので、cap 超過 probe でも DOM 件数と一致する。
 */

import { registerUnit } from '@oryzae/verify';
import type { FermentationDetail } from '@/features/shared/fermentation/types';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { FermentationSidebar } from './fermentation-sidebar';

interface Props {
  detail: FermentationDetail | null;
  collapsed: boolean;
  onToggle: () => void;
}

const SIDEBAR_SELECTOR = '[data-verify-unit="FermentationSidebar"]';

/** 瓶ビュー用の座標。サイドバーは座標を使わないので常に null でよい。 */
const NO_JAR_POS = { jarX: null, jarY: null };

const noop = () => {};

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
    // main の型集約で必須になったフィールド。サイドバーはまだ使わないので空で埋める。
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
    sourceDate: '2026-05-01',
    selectionReason: '日常の中の幸福を捉えた一節。',
    ...NO_JAR_POS,
  };
}

const fullDetail = makeDetail({
  keywords: [keyword('k1', '静けさ'), keyword('k2', '余白')],
  snippets: [snippet('s1', '朝の光が差し込む台所で、ゆっくりとコーヒーを淹れる時間が好きだ。')],
  letter: { id: 'l1', bodyText: 'あなたの言葉から、静かな強さを感じました。', ...NO_JAR_POS },
});

registerUnit<Props>({
  id: 'FermentationSidebar',
  title: 'FermentationSidebar',
  description: 'エントリー画面の右サイドバー。発酵結果（手紙/キーワード/スニペット）を集約する。',
  kind: 'component',
  render: (props) => withVerifyProviders(<FermentationSidebar {...props} />),
  fixtures: [
    {
      id: 'full',
      description: '手紙・キーワード2件・スニペット1件がすべて揃った状態',
      props: { detail: fullDetail, collapsed: false, onToggle: noop },
    },
    {
      id: 'letter-only',
      description: '手紙だけが届いている状態',
      props: {
        detail: makeDetail({
          letter: { id: 'l1', bodyText: '今週の言葉を受け取りました。', ...NO_JAR_POS },
        }),
        collapsed: false,
        onToggle: noop,
      },
    },
    {
      id: 'empty',
      probe: true,
      description: 'Probe: 完了済みだが中身が空（空状態の文言が出て崩れない）',
      props: { detail: makeDetail({}), collapsed: false, onToggle: noop },
    },
    {
      id: 'no-fermentation-yet',
      probe: true,
      description: 'Probe: 問いは紐づいているが発酵はまだ（面は開けて、中身が無いと言う）',
      props: { detail: null, collapsed: false, onToggle: noop },
    },
    {
      id: 'collapsed',
      description: '畳んだ状態（縁だけが残り、押せば開く）',
      props: { detail: fullDetail, collapsed: true, onToggle: noop },
    },
    {
      id: 'detail-open',
      description: 'キーワードを開いた状態（面は増えず、この面の中身が入れ替わる）',
      props: { detail: fullDetail, collapsed: false, onToggle: noop },
      act: async ({ root, wait }) => {
        const keyword = Array.from(root.querySelectorAll<HTMLElement>('button')).find((b) =>
          b.textContent?.includes('静けさ'),
        );
        if (!keyword) throw new Error('キーワードのボタンが見つからない');
        keyword.click();
        await wait(16);
      },
    },
    {
      id: 'over-cap',
      probe: true,
      description: 'Probe: cap 超過（キーワード7件・スニペット5件）でも 5/3 件に頭打ちになる',
      props: {
        detail: makeDetail({
          keywords: Array.from({ length: 7 }, (_, i) => keyword(`k${i}`, `言葉${i}`)),
          snippets: Array.from({ length: 5 }, (_, i) =>
            snippet(`s${i}`, `${'とても長い抜粋のテキスト'.repeat(6)}${i}`),
          ),
        }),
        collapsed: false,
        onToggle: noop,
      },
    },
  ],
  invariants: [
    {
      id: 'keyword-cap',
      description: 'キーワードは最大5件に頭打ちされ、契約が描画数と一致する',
      check: ({ contract, props }) => {
        const expected = Math.min(props.detail?.keywords.length ?? 0, 5);
        return (
          Number(contract.keywordCount) === expected ||
          `keywordCount=${contract.keywordCount}, 期待=${expected}`
        );
      },
    },
    {
      id: 'snippet-cap',
      description: 'スニペットは最大3件に頭打ちされ、契約が描画数と一致する',
      check: ({ contract, props }) => {
        const expected = Math.min(props.detail?.snippets.length ?? 0, 3);
        return (
          Number(contract.snippetCount) === expected ||
          `snippetCount=${contract.snippetCount}, 期待=${expected}`
        );
      },
    },
    {
      id: 'items-are-clickable',
      // **手紙はボタンではない**（畳まずそのまま置く）。
      // ことば・断片は、項目そのものが押せて掴める（触り方を2つ覚えさせない）。
      // 数え分けは fixture 名ではなく**契約**で行う——onlyFixtures で逃げると、
      // 新しい fixture を足したときに黙って的外れになる。
      description: '姿ごとにボタンの数が合う（一覧 / 中身 / 畳んだ姿）',
      check: ({ root, contract }) => {
        const sidebar = root.querySelector(SIDEBAR_SELECTOR);
        if (!sidebar) return 'FermentationSidebar の契約要素が見つからない';
        // 畳んだ姿は縁そのものが押せる要素なので、内側にボタンは無い。
        if (contract.collapsed === 'true') {
          const inner = sidebar.querySelectorAll('button').length;
          return inner === 0 || `畳んだ姿の内側にボタンが ${inner} 個ある`;
        }
        const buttons = sidebar.querySelectorAll('button').length;
        // ことば・断片は**項目そのもの**が押せて掴める（別の取っ手は持たない）。
        const expected =
          contract.detailOpen === 'true'
            ? 2 // 戻る + 閉じる
            : Number(contract.keywordCount) + Number(contract.snippetCount) + 1;
        return (
          buttons === expected ||
          `ボタン数=${buttons}, 期待=${expected}（detailOpen=${contract.detailOpen}）`
        );
      },
    },
    {
      id: 'letter-is-readable-without-a-click',
      // 押して開く形だと、この面に来た目的を読むのに1手余分に要る。
      description: '手紙は畳まず、そのまま読める形で置く',
      onlyFixtures: ['full', 'letter-only'],
      check: ({ root }) => {
        const sidebar = root.querySelector(SIDEBAR_SELECTOR);
        const opener = Array.from(sidebar?.querySelectorAll('button') ?? []).find((b) =>
          b.textContent?.includes('手紙'),
        );
        return opener === undefined || '手紙が押して開く形になっている';
      },
    },
    {
      id: 'collapsed-keeps-a-way-in',
      // 閉じたあと、開き直す場所が画面の反対側にしか無いのは遠い。
      description: '畳んでいても、押せば開く縁が残る',
      onlyFixtures: ['collapsed'],
      check: ({ root }) => {
        const rail = root.querySelector(SIDEBAR_SELECTOR);
        if (!(rail instanceof HTMLButtonElement)) return '畳んだ姿が押せる要素になっていない';
        return (
          rail.getAttribute('aria-expanded') === 'false' ||
          'aria-expanded で閉じていることを伝えていない'
        );
      },
    },
    {
      id: 'past-words-are-draggable',
      // 過去の言葉をいまの文章に取り込むのがこの面の役目。掴んで本文へ落とせる。
      // 掴める所と押せる所が同じ数＝**項目そのもの**が両方を担っている。
      description: 'ことばと断片は、項目そのものを掴んで本文へ引ける',
      onlyFixtures: ['full'],
      check: ({ root, contract }) => {
        const sidebar = root.querySelector(SIDEBAR_SELECTOR);
        const draggable = Array.from(sidebar?.querySelectorAll('[draggable="true"]') ?? []);
        const expected = Number(contract.keywordCount) + Number(contract.snippetCount);
        if (draggable.length !== expected) {
          return `掴める項目=${draggable.length}, 期待=${expected}`;
        }
        const notButtons = draggable.filter((el) => !(el instanceof HTMLButtonElement));
        return (
          notButtons.length === 0 ||
          `${notButtons.length} 個が押せない（掴めるだけの取っ手が残っている）`
        );
      },
    },
    {
      id: 'stays-one-surface',
      // 以前は項目を押すと別の面が右から重なった（面が2枚・閉じる操作も2回）。
      description: '項目を開いても面は1枚のまま（一覧と中身が入れ替わる）',
      onlyFixtures: ['detail-open'],
      check: ({ root, contract }) => {
        const surfaces = root.querySelectorAll('aside').length;
        if (surfaces !== 1) return `面が ${surfaces} 枚ある（1枚であるべき）`;
        if (contract.detailOpen !== 'true') return '中身が開いていない';
        // 中身を出しているあいだ、一覧の項目は消えている（重ねて出さない）。
        const sidebar = root.querySelector(SIDEBAR_SELECTOR);
        const listItems = sidebar?.querySelectorAll('section').length ?? 0;
        return listItems === 0 || `中身を開いているのに一覧が ${listItems} 節残っている`;
      },
    },
    {
      id: 'detail-has-a-way-back',
      // 戻る道は**1つ**。同じ場所に戻すボタンが2つあると、どちらが何なのか考えさせる。
      description: '中身を開いたら、一覧へ戻る道が1つある',
      onlyFixtures: ['detail-open'],
      check: ({ root }) => {
        const sidebar = root.querySelector(SIDEBAR_SELECTOR);
        const buttons = Array.from(sidebar?.querySelectorAll('button') ?? []);
        return buttons.length === 2 || `ボタンが ${buttons.length} 個（戻る + 閉じるの2つ）`;
      },
    },
    {
      id: 'empty-contract-matches',
      description: 'empty 契約が「手紙もキーワードもスニペットも無い」と一致する',
      check: ({ contract }) => {
        const derived =
          Number(contract.keywordCount) === 0 &&
          Number(contract.snippetCount) === 0 &&
          contract.hasLetter === 'false';
        return (
          contract.empty === String(derived) ||
          `empty=${contract.empty} だが中身から導かれる値は ${derived}`
        );
      },
    },
  ],
});
