'use client';

import { verifyAttrs } from '@oryzae/verify';

interface InlineImageDropIndicatorProps {
  /** 落ちる先（指している文字のキャレット位置）。null なら何も描かない。 */
  rect: DOMRect | null;
}

/** 線の太さ。キャレットと同じくらいの細さにする。 */
const THICKNESS = 2;
/** 行末など、キャレットの実寸が取れないときの最短の長さ。 */
const MIN_LENGTH = 12;

/**
 * 掴んだ写真が**どこへ入るか**を示す細い線。
 *
 * 引っ張っている最中、いまどの行のどこに落ちるのかが分からなかった。写真そのものは
 * 指の下にあって見えないので、**落ちる先**を本文の側に描く。
 *
 * キャレット（文字の間）の実寸をそのまま線にするので、書字方向を判定しない。
 * 横書きならキャレットは縦に立ち（幅 0）、縦書きなら横に寝る（高さ 0）。
 * 長いほうの軸に沿って線を引けば、どちらでも「文字の間」を指せる。
 */
export function InlineImageDropIndicator({ rect }: InlineImageDropIndicatorProps) {
  if (!rect) return null;

  const lying = rect.width > rect.height;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed z-[60] rounded-full"
      style={{
        left: rect.left,
        top: rect.top,
        width: lying ? Math.max(rect.width, MIN_LENGTH) : THICKNESS,
        height: lying ? THICKNESS : Math.max(rect.height, MIN_LENGTH),
        background: 'var(--accent, #3b82f6)',
      }}
      {...verifyAttrs({
        unit: 'InlineImageDropIndicator',
        orientation: lying ? 'lying' : 'standing',
      })}
    />
  );
}
