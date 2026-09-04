/**
 * JarBottle の検証スペック（中央に置く「壜」の絵・端末非依存）。
 *
 * props も router もデータ取得も持たない。i18n（jar.particle_* / jar.filler_*）だけに
 * 依存するので withVerifyProviders で包む。
 *
 * 守りたいのは「壜が壜のまま留まること」:
 *  - 硝子の輪郭（JAR_PATH）が描かれている。ここが消えると SP でも PC でも「同じ壜」でなくなる
 *  - 中の言葉が **壜の内側に切り抜かれている**（clip-path）。切り抜きが外れると、言葉が
 *    壜の外へはみ出して漂う（実際に一度そうなった形なので契約にする）
 *  - 言葉の数が契約と一致する（翻訳鍵の増減がそのまま見た目の密度になる）
 */

import { registerUnit } from '@oryzae/verify';
import { JAR_PATH, JAR_VIEWBOX, toUnitPath } from '@/features/shared/fermentation/jar-path';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { JarBottle } from './jar-bottle';

type Props = Record<string, never>;

registerUnit<Props>({
  id: 'JarBottle',
  title: 'JarBottle',
  description: '中央に置く壜の絵。硝子・発酵液・漂う言葉・微生物。PC の瓶と SP の瓶で共有する。',
  kind: 'component',
  render: () =>
    withVerifyProviders(
      <div style={{ width: '320px', height: '400px' }}>
        <JarBottle />
      </div>,
    ),
  fixtures: [
    {
      id: 'default',
      probe: true,
      description: 'Probe: 壜・発酵液・漂う言葉・微生物が描かれる（props なしの固定描画）',
      props: {},
    },
  ],
  invariants: [
    {
      id: 'glass-silhouette-present',
      description: '硝子の輪郭（JAR_PATH）が描かれている',
      check: ({ root }) => {
        const paths = [...root.querySelectorAll('svg path')];
        const hasBody = paths.some((p) => p.getAttribute('d') === JAR_PATH);
        return hasBody || '壜の輪郭（JAR_PATH）を持つ path が無い';
      },
    },
    {
      id: 'words-clipped-inside-jar',
      description: '漂う言葉は壜の内側に切り抜かれる（器の大きさに依らない比率の切り抜き）',
      check: ({ root }) => {
        const clipped = [...root.querySelectorAll('div')].find((el) =>
          el.style.clipPath.includes('url('),
        );
        if (!clipped) return '言葉を切り抜くコンテナが無い（壜の外へはみ出す）';

        const id = clipped.style.clipPath.match(/url\(["']?#([^"')]+)/)?.[1];
        const clip = id ? root.querySelector(`clipPath#${id}`) : null;
        if (!clip) return `切り抜き #${id ?? '?'} が定義されていない`;
        // 絶対 px の path() だと器の大きさに追従せず、SP で壜の外へこぼれた。
        if (clip.getAttribute('clipPathUnits') !== 'objectBoundingBox') {
          return '切り抜きが比率指定でない（器の大きさが変わると壜とずれる）';
        }

        const expected = toUnitPath(JAR_PATH, JAR_VIEWBOX.width, JAR_VIEWBOX.height);
        const actual = clip.querySelector('path')?.getAttribute('d') ?? '';
        return actual === expected || `切り抜きが壜の輪郭と違う: ${actual.slice(0, 40)}…`;
      },
    },
    {
      id: 'drawing-keeps-viewbox-ratio',
      description: '絵の器は viewBox と同じ比（ずれると切り抜きが壜からはみ出す）',
      check: ({ root }) => {
        const svg = root.querySelector('svg');
        const box = svg?.parentElement;
        if (!(box instanceof HTMLElement)) return '壜の器が見つからない';
        const expected = `${JAR_VIEWBOX.width} / ${JAR_VIEWBOX.height}`;
        return (
          box.style.aspectRatio.replace(/\s/g, '') === expected.replace(/\s/g, '') ||
          `器の比が ${box.style.aspectRatio || '未指定'}（期待: ${expected}）`
        );
      },
    },
    {
      id: 'word-count-matches-contract',
      description: '漂う言葉の数が contract.wordCount と一致する',
      check: ({ root, contract }) => {
        const clipped = [...root.querySelectorAll('div')].find((el) =>
          el.style.clipPath.includes('url('),
        );
        const words = clipped?.querySelectorAll('span').length ?? 0;
        return (
          String(words) === contract.wordCount ||
          `言葉の数=${words} だが contract.wordCount="${contract.wordCount}"`
        );
      },
    },
    {
      id: 'decorative-svg-stays-hidden',
      description: '壜の SVG は装飾なので a11y ツリーに出さない（aria-hidden 維持）',
      check: ({ root }) => {
        const svg = root.querySelector('svg');
        return (
          svg?.getAttribute('aria-hidden') === 'true' ||
          `壜の svg が a11y ツリーに露出している: aria-hidden=${svg?.getAttribute('aria-hidden')}`
        );
      },
    },
  ],
});
