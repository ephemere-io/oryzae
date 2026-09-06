/**
 * SpJarOrbit の検証スペック（壜のまわりを問いの円が回る軌道）。
 *
 * props だけで成立する presentational な部品。回転そのものは rAF が style を直接書くので
 * 孤立検証では見ない（時間に依存する見た目は orbit.ts の単体テストが数値で固定している）。
 * ここで守るのは **静止画としての契約**: 円の数・押せること・問いが読めること。
 *
 * 中の壜（JarBottle）が i18n を使うので withVerifyProviders で包む。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { type OrbitQuestion, SpJarOrbit } from './sp-jar-orbit';

interface Props {
  questions: OrbitQuestion[];
  onSelect: (questionId: string) => void;
}

const noop = () => {};

/**
 * 「開いた」記録。fixture は順に走るので act の先頭で空にしてから使う。
 *
 * 回してから指を離した位置の円が開いてしまう不具合を捕まえるために要る
 * （click は pointerup の後に来るので、DOM を見るだけでは区別できない）。
 */
const selections: string[] = [];
const record = (id: string) => {
  selections.push(id);
};

/** 指で円を回す。jsdom には PointerEvent が無いことがあるので MouseEvent で代用する。 */
function drag(root: HTMLElement, fromX: number, toX: number): void {
  const orbit = root.querySelector('[data-verify-unit="SpJarOrbit"]');
  if (!orbit) throw new Error('軌道が見つからない');
  const send = (type: string, clientX: number) => {
    const Ctor = typeof PointerEvent === 'function' ? PointerEvent : MouseEvent;
    orbit.dispatchEvent(new Ctor(type, { bubbles: true, clientX, clientY: 300 }));
  };
  send('pointerdown', fromX);
  const step = toX > fromX ? 20 : -20;
  for (let x = fromX + step; step > 0 ? x <= toX : x >= toX; x += step) send('pointermove', x);
  send('pointerup', toX);
}

const three: OrbitQuestion[] = [
  {
    id: 'q-1',
    text: '最近うれしかったことは？',
    hasLetter: true,
    unread: true,
    keywords: ['感謝', '余白'],
    snippetCount: 2,
  },
  {
    id: 'q-2',
    text: 'なぜ続けているのか',
    hasLetter: true,
    unread: false,
    keywords: ['静けさ'],
    snippetCount: 1,
  },
  {
    id: 'q-3',
    text: 'いま怖いものは何か',
    hasLetter: false,
    unread: false,
    keywords: [],
    snippetCount: 0,
  },
];

/** 問いの上限ちょうど（MAX_QUESTION_STRING_LENGTH = 64 字）。いちばん厳しい場合を見る。 */
const longText =
  'ここ数ヶ月のあいだに自分のなかで静かに変わってしまったものは何だったのか、それをいまあらためて言葉にするとどんな形になるだろうか';

registerUnit<Props>({
  id: 'SpJarOrbit',
  title: 'SpJarOrbit',
  description: '中央の壜と、そのまわりを回る問いの円。指で払うと速く回り、タップで開く。',
  kind: 'component',
  render: (props) =>
    withVerifyProviders(
      <div style={{ display: 'flex', flexDirection: 'column', width: '390px', height: '560px' }}>
        <SpJarOrbit {...props} />
      </div>,
    ),
  fixtures: [
    {
      id: 'three',
      description: '問いが3件（未読・既読・発酵前がひとつずつ）',
      props: { questions: three, onSelect: noop },
    },
    {
      id: 'one',
      probe: true,
      description: 'Probe: 問いが1件でも軌道として成立する（1件を割る計算が壊れない）',
      props: { questions: [three[0]], onSelect: noop },
    },
    {
      id: 'empty',
      probe: true,
      description: 'Probe: 問いが0件なら壜だけが残る（円は描かない）',
      props: { questions: [], onSelect: noop },
    },
    {
      id: 'tap-opens',
      probe: true,
      description: 'Probe: 円をタップすると開く（回していないので開く）',
      props: { questions: three, onSelect: record },
      act: async (ctx) => {
        selections.length = 0;
        await ctx.click('button[data-question-id="q-1"]');
        await ctx.wait(16);
      },
    },
    {
      id: 'drag-does-not-open',
      probe: true,
      description: 'Probe: 回して指を離しても、その位置の円は開かない',
      props: { questions: three, onSelect: record },
      act: async (ctx) => {
        selections.length = 0;
        drag(ctx.root, 60, 260);
        await ctx.click('button[data-question-id="q-1"]');
        await ctx.wait(16);
      },
    },
    {
      id: 'long-text',
      probe: true,
      description: 'Probe: 上限いっぱいの問いでも、輪を増やして全文を出す',
      props: {
        questions: [
          {
            id: 'q-long',
            text: longText,
            hasLetter: false,
            unread: false,
            keywords: [],
            snippetCount: 0,
          },
        ],
        onSelect: noop,
      },
    },
  ],
  invariants: [
    {
      id: 'one-button-per-question',
      description: '円の数が contract.count と一致し、すべて押せる',
      check: ({ root, contract }) => {
        const buttons = root.querySelectorAll('button[data-question-id]');
        return (
          String(buttons.length) === contract.count ||
          `円の数=${buttons.length} だが contract.count="${contract.count}"`
        );
      },
    },
    {
      id: 'circles-are-named',
      description: '円は問い文をアクセシブル名に持つ（リング文字は aria-hidden なので）',
      check: ({ root }) => {
        const buttons = Array.from(root.querySelectorAll('button[data-question-id]'));
        const unnamed = buttons.filter((b) => !b.getAttribute('aria-label')).length;
        return unnamed === 0 || `${unnamed} 個の円に名前が無い（読み上げで区別できない）`;
      },
    },
    {
      id: 'tap-opens-the-circle',
      description: 'タップは円を開く',
      onlyFixtures: ['tap-opens'],
      check: () =>
        (selections.length === 1 && selections[0] === 'q-1') ||
        `開いたのは ${JSON.stringify(selections)}（期待: ["q-1"]）`,
    },
    {
      id: 'drag-does-not-open-the-circle',
      description: '回した直後の指離しは開かない（click は pointerup の後に来る）',
      onlyFixtures: ['drag-does-not-open'],
      check: () =>
        selections.length === 0 || `回しただけで開いてしまった: ${JSON.stringify(selections)}`,
    },
    {
      id: 'contents-visible-before-opening',
      description: '開く前から円の中に言葉が見えている（タップして初めて出るのではない）',
      onlyFixtures: ['three'],
      check: ({ root }) => {
        const front = root.querySelector('button[data-question-id="q-1"]');
        const text = front?.textContent ?? '';
        return (
          (text.includes('感謝') && text.includes('余白')) ||
          `円の中に言葉が出ていない: "${text.slice(0, 40)}"`
        );
      },
    },
    {
      id: 'stacking-stays-inside',
      description: '円の重なり順は軌道の中で閉じる（開いた画面やシートを突き抜けない）',
      check: ({ root }) => {
        const orbit = root.querySelector('[data-verify-unit="SpJarOrbit"]');
        if (!(orbit instanceof HTMLElement)) return '軌道が見つからない';
        // 円は奥行きを z-index 0..1000 で表す。ここで層を閉じないと、その数値が
        // 外側の層（開いた円 z-20・シート z-30）に勝ってしまう。
        return (
          orbit.style.isolation === 'isolate' ||
          `isolation=${orbit.style.isolation || '未指定'}（円の z-index が外へ漏れる）`
        );
      },
    },
    {
      id: 'jar-stays-at-center',
      description: '壜は常に中央にある（円が0件でも消えない）',
      check: ({ root }) => {
        const jar = root.querySelector('[data-verify-unit="JarBottle"]');
        return jar !== null || '壜が描かれていない';
      },
    },
    {
      id: 'ring-text-is-readable-size',
      description: 'リング文字は SP で読める大きさ（12px 以上）',
      check: ({ root }) => {
        const texts = Array.from(root.querySelectorAll('button[data-question-id] text'));
        if (texts.length === 0) return true;
        const tooSmall = texts.filter((t) => {
          const size = Number.parseFloat(
            t instanceof SVGElement || t instanceof HTMLElement ? t.style.fontSize : '0',
          );
          return !(size >= 12);
        }).length;
        return tooSmall === 0 || `${tooSmall} 個のリング文字が 12px 未満`;
      },
    },
    {
      id: 'question-is-never-cut',
      description: '問いは切らない（読めない問いなら円に置く意味が無い）',
      check: ({ root }) => {
        // textPath は経路に収まらない分を黙って捨てる。畳んだ印（…）が出ていたら、
        // 輪の増やし方が足りていない。
        const folded = Array.from(root.querySelectorAll('button[data-question-id] textPath'))
          .map((path) => path.textContent ?? '')
          .filter((text) => text.endsWith('…'));
        return folded.length === 0 || `${folded.length} 個の問いが畳まれている`;
      },
    },
    {
      id: 'long-question-reads-whole',
      description: '上限いっぱい（64 字）の問いも、輪をつなぐと全文になる',
      onlyFixtures: ['long-text'],
      check: ({ root }) => {
        const circle = root.querySelector('button[data-question-id]');
        const rings = Array.from(circle?.querySelectorAll('textPath') ?? []);
        const read = rings.map((path) => path.textContent ?? '').join('');
        if (read !== longText)
          return `輪をつないでも全文にならない（${read.length}/${longText.length} 字）`;
        // 外側の輪から読む。12 時では外の輪が上に来るので、横書きと同じ順になる。
        const radii = rings.map((path) => {
          const id = path.getAttribute('href')?.slice(1) ?? '';
          return Number.parseFloat(id.split('-').at(-1) ?? '0');
        });
        const outerFirst = [...radii].sort((a, b) => b - a);
        return (
          radii.every((radius, i) => radius === outerFirst[i]) ||
          `読む順が外→内になっていない: ${radii.join(',')}`
        );
      },
    },
    {
      id: 'no-circles-when-empty',
      description: '問いが0件なら円を描かない',
      onlyFixtures: ['empty'],
      check: ({ root, contract }) => {
        const buttons = root.querySelectorAll('button[data-question-id]').length;
        return (
          (contract.count === '0' && buttons === 0) || `count=${contract.count}, 円=${buttons}`
        );
      },
    },
  ],
});
