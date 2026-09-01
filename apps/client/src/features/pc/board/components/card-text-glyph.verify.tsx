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

interface Props {
  withHeading?: boolean;
}

registerUnit<Props>({
  id: 'CardTextGlyph',
  title: 'CardTextGlyph',
  description: '引ききった倍率で本文の代わりに置く「文字があるしるし」。',
  kind: 'component',
  render: (props) => <CardTextGlyph {...props} />,
  fixtures: [
    {
      id: 'snippet',
      description: 'スニペット（見出し行なし・本文だけ）',
      props: { withHeading: false },
    },
    {
      id: 'entry',
      description: 'エントリ（見出し行あり）',
      props: { withHeading: true },
    },
    {
      id: 'default',
      probe: true,
      description: 'Probe: 既定（withHeading 省略）でも本文行は描かれる',
      props: {},
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
      description: '契約 lineCount と実際に描いた本数（見出し含む）が一致する',
      check: ({ root, contract }) => {
        const body = root.querySelectorAll('[data-verify-part="glyph-line"]').length;
        const heading = root.querySelectorAll('[data-verify-part="glyph-heading"]').length;
        const drawn = body + heading;
        return (
          drawn === Number(contract.lineCount) ||
          `契約 lineCount=${contract.lineCount} だが実際は ${drawn} 本（本文${body} + 見出し${heading}）`
        );
      },
    },
    {
      id: 'heading-iff-with-heading',
      description: '見出し行は withHeading=true のときだけ描かれる',
      check: ({ root, contract }) => {
        const hasHeading = root.querySelectorAll('[data-verify-part="glyph-heading"]').length === 1;
        const expected = contract.withHeading === 'true';
        return (
          hasHeading === expected ||
          `見出し行 present=${hasHeading} だが contract.withHeading="${contract.withHeading}"`
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
