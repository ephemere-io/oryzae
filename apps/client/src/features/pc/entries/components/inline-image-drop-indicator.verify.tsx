/**
 * InlineImageDropIndicator の検証スペック。
 *
 * 見張るのは「**キャレットの向きに沿う**」こと。横書きのキャレットは縦に立ち（幅 0）、
 * 縦書きでは横に寝る（高さ 0）。書字方向を判定せず実寸に従う作りなので、ここが崩れると
 * 縦書きで線が明後日の向きに出る。
 *
 * 「指していないときは何も描かない」は fixture にしない（契約のノードごと消えるため、
 * 孤立検証の土俵に乗らない）。そちらは test/.../inline-image-drop-indicator.test.tsx。
 */

import { registerUnit } from '@oryzae/verify';
import { InlineImageDropIndicator } from './inline-image-drop-indicator';

interface Props {
  rect: DOMRect;
}

/** DOMRect はテスト環境によっては未定義なので、素のオブジェクトで代用する。 */
function rect(over: Partial<DOMRect>): DOMRect {
  const base = { x: 0, y: 0, width: 0, height: 0, left: 0, top: 0, right: 0, bottom: 0 };
  const merged = { ...base, ...over };
  return { ...merged, toJSON: () => ({}) };
}

registerUnit<Props>({
  id: 'InlineImageDropIndicator',
  title: 'InlineImageDropIndicator',
  description: '掴んだ写真が落ちる先（文字の間）を示す細い線。',
  kind: 'component',
  render: (props) => <InlineImageDropIndicator rect={props.rect} />,
  fixtures: [
    {
      id: 'standing',
      probe: true,
      description: 'Probe: 横書き — キャレットは縦に立つ（幅 0）',
      props: { rect: rect({ left: 240, top: 120, width: 0, height: 28, right: 240, bottom: 148 }) },
    },
    {
      id: 'lying',
      probe: true,
      description: 'Probe: 縦書き — キャレットは横に寝る（高さ 0）',
      props: { rect: rect({ left: 300, top: 200, width: 30, height: 0, right: 330, bottom: 200 }) },
    },
    {
      id: 'thin-line',
      description: '行末など、キャレットの実寸が取れないとき（最短の長さで出す）',
      props: { rect: rect({ left: 100, top: 100, width: 0, height: 0, right: 100, bottom: 100 }) },
    },
  ],
  invariants: [
    {
      id: 'follows-the-caret',
      description: '線はキャレットの長いほうの軸に沿う',
      check: ({ contract, props }) => {
        const expected = props.rect.width > props.rect.height ? 'lying' : 'standing';
        return contract.orientation === expected || `向きが違う: ${contract.orientation}`;
      },
    },
    {
      id: 'stays-visible',
      // 実寸が 0 の位置（行末など）でも、指していることは見えていないと意味が無い。
      description: 'どの向きでも、線には見える長さがある',
      check: ({ root }) => {
        const line = root.querySelector<HTMLElement>(
          '[data-verify-unit="InlineImageDropIndicator"]',
        );
        if (!line) return '線が無い';
        const width = Number.parseFloat(line.style.width);
        const height = Number.parseFloat(line.style.height);
        return (
          (width >= 2 && height >= 2) || `線が細すぎる: ${line.style.width} × ${line.style.height}`
        );
      },
    },
    {
      id: 'does-not-swallow-pointer',
      // 落ちる先を指したまま線の上を通るので、線が操作を受け取ると落とせなくなる。
      description: '線は操作を受け取らない',
      check: ({ root }) => {
        const line = root.querySelector('[data-verify-unit="InlineImageDropIndicator"]');
        if (!line) return '線が無い';
        return line.className.includes('pointer-events-none') || '線がクリックを受け取ってしまう';
      },
    },
  ],
});
