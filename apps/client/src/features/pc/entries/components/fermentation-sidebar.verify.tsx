/**
 * FermentationSidebar の検証スペック（Issue #466）。
 *
 * detail を props で受け取り、手紙・キーワード・スニペットをサイドバーに集約する部品。
 * データ取得は親（useFermentationForQuestion）が担うので props だけで孤立レンダリングできる。
 *
 * 注意:
 * - **面は1枚**。項目を開いても別の面は生えず、この面の中身が一覧 ⇄ 中身で入れ替わる。
 * - 面は**2つの軸**で決まる: どの問いの（＝どの発酵の）、何を（手紙 / ことば / 断片）。
 *   後者は左のサイドバーと同じ行（components/ui/nav-row）で並べる。
 * - キーワードは 5 件、スニペットは 3 件で slice する。契約は **描画済み（cap 後）** の件数を
 *   公表するので、cap 超過 probe でも DOM 件数と一致する。
 */

import { registerUnit } from '@oryzae/verify';
import type { FermentationDetail } from '@/features/shared/fermentation/types';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { FermentationSidebar, type SidebarQuestion } from './fermentation-sidebar';

interface Props {
  detail: FermentationDetail | null;
  questions: SidebarQuestion[];
  selectedQuestionId: string | null;
  loading?: boolean;
  collapsed: boolean;
}

const SIDEBAR_SELECTOR = '[data-verify-unit="FermentationSidebar"]';
/** 面の中の切り替え。左のサイドバーと同じ行を使うので、同じ契約で数えられる。 */
const NAV_ROW_SELECTOR = '[data-verify-unit="NavRow"]';

/** 瓶ビュー用の座標。サイドバーは座標を使わないので常に null でよい。 */
const NO_JAR_POS = { jarX: null, jarY: null };

const noop = () => {};

const ONE_QUESTION: SidebarQuestion[] = [{ id: 'q-1', text: 'いま、何に守られている？' }];
const TWO_QUESTIONS: SidebarQuestion[] = [
  ...ONE_QUESTION,
  { id: 'q-2', text: '手放したいものは何？' },
];

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

/** 面の中の切り替えを、名前で押す。 */
async function switchTo(
  root: HTMLElement,
  label: string,
  wait: (ms: number) => Promise<void>,
): Promise<void> {
  const row = Array.from(root.querySelectorAll<HTMLElement>(NAV_ROW_SELECTOR)).find(
    (el) => el.getAttribute('data-verify-label') === label,
  );
  if (!row) throw new Error(`切り替え「${label}」が見つからない`);
  row.click();
  await wait(16);
}

registerUnit<Props>({
  id: 'FermentationSidebar',
  title: 'FermentationSidebar',
  description: 'エントリー画面の右サイドバー。発酵結果（手紙/ことば/断片）を集約する。',
  kind: 'component',
  render: (props) =>
    withVerifyProviders(<FermentationSidebar {...props} onSelectQuestion={noop} onToggle={noop} />),
  fixtures: [
    {
      id: 'full',
      description: '手紙・キーワード2件・スニペット1件がすべて揃った状態（既定は手紙）',
      props: {
        detail: fullDetail,
        questions: ONE_QUESTION,
        selectedQuestionId: 'q-1',
        collapsed: false,
      },
    },
    {
      id: 'letter-only',
      description: '手紙だけが届いている状態',
      props: {
        detail: makeDetail({
          letter: { id: 'l1', bodyText: '今週の言葉を受け取りました。', ...NO_JAR_POS },
        }),
        questions: ONE_QUESTION,
        selectedQuestionId: 'q-1',
        collapsed: false,
      },
    },
    {
      id: 'two-questions',
      description: '問いが2つ結ばれている（どちらの発酵を見るか選べる）',
      props: {
        detail: fullDetail,
        questions: TWO_QUESTIONS,
        selectedQuestionId: 'q-1',
        collapsed: false,
      },
    },
    {
      id: 'keywords-view',
      description: 'ことばに切り替えた状態',
      props: {
        detail: fullDetail,
        questions: ONE_QUESTION,
        selectedQuestionId: 'q-1',
        collapsed: false,
      },
      act: async ({ root, wait }) => switchTo(root, 'キーワード', wait),
    },
    {
      id: 'snippets-view',
      description: '断片に切り替えた状態',
      props: {
        detail: fullDetail,
        questions: ONE_QUESTION,
        selectedQuestionId: 'q-1',
        collapsed: false,
      },
      act: async ({ root, wait }) => switchTo(root, 'スニペット', wait),
    },
    {
      id: 'empty',
      probe: true,
      description: 'Probe: 完了済みだが中身が空（切り替えは3つ残り、空状態の文言が出る）',
      props: {
        detail: makeDetail({}),
        questions: ONE_QUESTION,
        selectedQuestionId: 'q-1',
        collapsed: false,
      },
    },
    {
      id: 'no-fermentation-yet',
      probe: true,
      description: 'Probe: 問いは紐づいているが発酵はまだ（面は開けて、中身が無いと言う）',
      props: {
        detail: null,
        questions: ONE_QUESTION,
        selectedQuestionId: 'q-1',
        collapsed: false,
      },
    },
    {
      id: 'loading',
      probe: true,
      description: 'Probe: 問いを選び直した直後（空と読み込み中を混同しない）',
      props: {
        detail: null,
        questions: TWO_QUESTIONS,
        selectedQuestionId: 'q-2',
        loading: true,
        collapsed: false,
      },
    },
    {
      id: 'collapsed',
      description: '畳んだ状態（縁だけが残り、押せば開く）',
      props: {
        detail: fullDetail,
        questions: ONE_QUESTION,
        selectedQuestionId: 'q-1',
        collapsed: true,
      },
    },
    {
      id: 'detail-open',
      description: 'キーワードを開いた状態（面は増えず、この面の中身が入れ替わる）',
      props: {
        detail: fullDetail,
        questions: ONE_QUESTION,
        selectedQuestionId: 'q-1',
        collapsed: false,
      },
      act: async ({ root, wait }) => {
        await switchTo(root, 'キーワード', wait);
        const item = Array.from(root.querySelectorAll<HTMLElement>('button')).find((b) =>
          b.textContent?.includes('静けさ'),
        );
        if (!item) throw new Error('キーワードのボタンが見つからない');
        item.click();
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
        questions: ONE_QUESTION,
        selectedQuestionId: 'q-1',
        collapsed: false,
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
      id: 'every-kind-is-always-listed',
      // 中身があるものだけ並べると、無いものは**入れ物ごと存在しない**ように見える。
      // 3つは常に並べ、空かどうかは開いた先で言う（パレットの非活性と同じ考え）。
      description: '開いているときは、手紙・ことば・断片の3つが必ず並ぶ',
      check: ({ root, contract }) => {
        if (contract.collapsed === 'true') return true;
        const rows = root.querySelectorAll(NAV_ROW_SELECTOR).length;
        return rows === 3 || `切り替えが ${rows} 個（3つであるべき）`;
      },
    },
    {
      id: 'exactly-one-view-is-active',
      // どれを見ているのかが色でしか分からない状態にしない（契約でも1つに定まる）。
      description: '一覧を見ているあいだ、選ばれている切り替えはちょうど1つ',
      check: ({ root, contract }) => {
        if (contract.collapsed === 'true' || contract.detailOpen === 'true') return true;
        const active = Array.from(root.querySelectorAll(NAV_ROW_SELECTOR)).filter(
          (el) => el.getAttribute('data-verify-active') === 'true',
        );
        if (active.length !== 1) return `選ばれている切り替えが ${active.length} 個`;
        return (
          active[0]?.getAttribute('aria-pressed') === 'true' ||
          '選ばれていることが aria-pressed で伝わっていない'
        );
      },
    },
    {
      id: 'letter-comes-first',
      // この面に来る目的は手紙。届いているなら、押さずに読める状態で開く。
      description: '手紙があるときは、何も押さずに手紙が開いている',
      onlyFixtures: ['full', 'letter-only', 'two-questions'],
      check: ({ contract }) =>
        contract.view === 'letter' || `最初に開いている面が ${contract.view} になっている`,
    },
    {
      // 「掴める項目の数が view と合う」だけだと、切り替えが空振りして手紙のままでも
      // 0 件どうしで釣り合ってしまう。**押した先が本当に開いたか**を別に見る。
      id: 'keywords-view-shows-keywords',
      description: 'ことばに切り替えたら、ことばが出ている',
      onlyFixtures: ['keywords-view'],
      check: ({ root, contract }) => {
        if (contract.view !== 'keywords') return `切り替えが効いていない（view=${contract.view}）`;
        const sidebar = root.querySelector(SIDEBAR_SELECTOR);
        return sidebar?.textContent?.includes('静けさ') || 'ことばが出ていない';
      },
    },
    {
      id: 'snippets-view-shows-snippets',
      description: '断片に切り替えたら、断片が出ている',
      onlyFixtures: ['snippets-view'],
      check: ({ root, contract }) => {
        if (contract.view !== 'snippets') return `切り替えが効いていない（view=${contract.view}）`;
        const sidebar = root.querySelector(SIDEBAR_SELECTOR);
        return sidebar?.textContent?.includes('朝の光') || '断片が出ていない';
      },
    },
    {
      id: 'question-picker-only-when-there-is-a-choice',
      // 選択肢が1つの選択は、選択ではなく飾りになる。
      description: '問いが2つ以上あるときだけ、どれを見るかを選べる',
      check: ({ root, contract }) => {
        if (contract.collapsed === 'true') return true;
        const pickers = root.querySelectorAll('[role="combobox"]').length;
        const expected = Number(contract.questionCount) > 1 ? 1 : 0;
        return (
          pickers === expected ||
          `問いの切り替え=${pickers}, 期待=${expected}（問い ${contract.questionCount} 件）`
        );
      },
    },
    {
      id: 'loading-is-not-emptiness',
      // 取りに行っている最中に「ありません」と言うと、無いものとして受け取られる。
      description: '読み込み中は、空状態の文言を出さない',
      onlyFixtures: ['loading'],
      check: ({ root }) => {
        const sidebar = root.querySelector(SIDEBAR_SELECTOR);
        const text = sidebar?.textContent ?? '';
        if (text.includes('まだありません')) return '読み込み中に空状態の文言が出ている';
        return text.includes('読み込んで') || '読み込み中であることが伝わっていない';
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
      // 掴める所と押せる所が同じ＝**項目そのもの**が両方を担っている。
      description: '見ているものが、そのまま掴んで本文へ引ける',
      check: ({ root, contract }) => {
        if (contract.collapsed === 'true' || contract.detailOpen === 'true') return true;
        const sidebar = root.querySelector(SIDEBAR_SELECTOR);
        const draggable = Array.from(sidebar?.querySelectorAll('[draggable="true"]') ?? []);
        const expected =
          contract.view === 'keywords'
            ? Number(contract.keywordCount)
            : contract.view === 'snippets'
              ? Number(contract.snippetCount)
              : 0;
        if (draggable.length !== expected) {
          return `掴める項目=${draggable.length}, 期待=${expected}（view=${contract.view}）`;
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
        const stillListed = sidebar?.querySelectorAll('[draggable="true"]').length ?? 0;
        return stillListed === 0 || `中身を開いているのに一覧が ${stillListed} 件残っている`;
      },
    },
    {
      id: 'detail-has-a-way-back',
      // 戻る道は**1つ**。同じ場所に戻すボタンが2つあると、どちらが何なのか考えさせる。
      description: '中身を開いたら、一覧へ戻る道が1つある',
      onlyFixtures: ['detail-open'],
      check: ({ root }) => {
        const sidebar = root.querySelector(SIDEBAR_SELECTOR);
        const back = Array.from(sidebar?.querySelectorAll('button') ?? []).filter(
          (b) => b.getAttribute('aria-label') === '一覧に戻る',
        );
        return back.length === 1 || `戻るボタンが ${back.length} 個（1つであるべき）`;
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
