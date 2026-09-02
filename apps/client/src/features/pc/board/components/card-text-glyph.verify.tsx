/**
 * CardTextGlyph の検証スペック。
 * 引ききった倍率で本文の代わりに置く図。props だけで孤立描画でき、i18n も router も使わない。
 *
 * この部品の存在意義は「空白にしない」ことなので、**行が必ず1本以上描かれる**ことと
 * **契約の行数と実際に描いた本数が一致する**ことを不変条件にする。
 * ここが崩れると、レビューで指摘された「中身が無いカードに見える」状態に戻る。
 */

import { registerUnit } from '@oryzae/verify';
import { CardTextGlyph } from './card-text-glyph';

// 部品自体は props を持たない（描くものが常に同じ）。
// 外枠の寸法だけは検証側から変える。この部品は h-full なので、
// **入れ物が小さいときにどうなるか**が唯一の変数だから。
interface Props {
  /** カードの高さ（world px）。スニペットは本文量でカードが伸縮する。 */
  cardHeight: number;
}

registerUnit<Props>({
  id: 'CardTextGlyph',
  title: 'CardTextGlyph',
  description: '引ききった倍率で本文の代わりに置く「文字があるしるし」。',
  kind: 'component',
  render: ({ cardHeight }) => (
    <div style={{ height: cardHeight, width: 262 }}>
      <CardTextGlyph />
    </div>
  ),
  fixtures: [
    {
      id: 'default',
      description: 'スニペットの既定サイズ（本文の代わりに置く行の並び）',
      props: { cardHeight: 200 },
    },
    {
      id: 'tiny-card',
      probe: true,
      description:
        'Probe: 本文が短くカードが最小近くまで縮んでも、行を1本も落とさない（空白に戻さない）',
      // Zod の下限（120）ぎりぎり。上下 padding 24+24 を引くと本文域は 72px しかなく、
      // 行4本＋隙間（42px）は入るが余裕は無い。ここで行を間引く実装にすると、
      // 小さいカードだけ空白に戻る。
      props: { cardHeight: 120 },
    },
  ],
  invariants: [
    {
      id: 'never-blank',
      description: '行が必ず1本以上ある（空白にしないことがこの部品の目的）',
      check: ({ root }) => {
        const lines = root.querySelectorAll('[data-verify-part="glyph-line"]');
        return lines.length > 0 || '行が1本も描かれていない（空白のカードに戻っている）';
      },
    },
    {
      id: 'line-count-matches-contract',
      description: '契約 lineCount と実際に描いた本数が一致する',
      check: ({ root, contract }) => {
        const drawn = root.querySelectorAll('[data-verify-part="glyph-line"]').length;
        return (
          drawn === Number(contract.lineCount) ||
          `契約 lineCount=${contract.lineCount} だが実際は ${drawn} 本`
        );
      },
    },
    {
      id: 'ink-follows-the-theme',
      description:
        '線は本文と同じインク（--fg）で描く。色をベタ書きすると暗いテーマで沈んで「消えた」ように見える',
      check: ({ root }) => {
        const bars = Array.from(
          root.querySelectorAll<HTMLElement>('[data-verify-part="glyph-line"]'),
        );
        if (bars.length === 0) return '線が1本も無い';
        const hardcoded = bars.filter((el) => !el.className.includes('bg-[var(--fg)]'));
        return (
          hardcoded.length === 0 ||
          `テーマに追従しない線が ${hardcoded.length} 本ある（--fg 以外で塗っている）`
        );
      },
    },
    {
      id: 'decorative-and-inert',
      description: '装飾なので aria-hidden かつクリックを奪わない',
      check: ({ root }) => {
        const el = root.querySelector('[data-verify-unit="CardTextGlyph"]');
        if (!el) return 'ルートが見つからない';
        const hidden = el.getAttribute('aria-hidden') === 'true';
        const inert = el.className.includes('pointer-events-none');
        return (
          (hidden && inert) ||
          `aria-hidden=${el.getAttribute('aria-hidden')}, pointer-events-none=${inert}`
        );
      },
    },
  ],
});
