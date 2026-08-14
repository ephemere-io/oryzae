/**
 * スケルトン共通の invariant（Issue: 画面ごとのスケルトン）。
 *
 * スケルトンの唯一の仕事は「これから出る画面の形を先に置くこと」。壊れ方は決まっている:
 *  1. 代理するはずのパーツを描いていない（＝実画面と形が違う → 到着時にジャンプする）
 *  2. 文字を描いてしまう（＝ロード済みコンテンツと誤認される）
 *  3. 支援技術に読まれる（＝意味のない枠を読み上げる）
 * この3点を全スケルトンに共通で機械検証する。各ユニット固有の形（行数など）は
 * 各 `*.verify.tsx` 側の invariant で足す。
 *
 * 契約: ルートに `verifyAttrs({ unit, slots: 'a,b,c' })`、各パーツに `data-skeleton-slot="a"`。
 *
 * 配置が lib/ なのは dep-cruise の lib-independence に適合するため
 * （features/*.verify.tsx から lib/ は import 可。逆は不可）。
 */

import type { Invariant } from '@oryzae/verify';

export function skeletonInvariants<P>(): Invariant<P>[] {
  return [
    {
      id: 'declared-slots-are-rendered',
      description:
        '契約で宣言した slot が実 DOM に存在する（実画面のどのパーツを代理するかの明示）',
      check: ({ root, contract }) => {
        const declared = (contract.slots ?? '').split(',').filter(Boolean);
        if (declared.length === 0) {
          return 'data-verify-slots が空: 何を代理する枠なのか宣言されていない';
        }
        const missing = declared.filter(
          (slot) => !root.querySelector(`[data-skeleton-slot="${slot}"]`),
        );
        return missing.length === 0 || `宣言した slot が描かれていない: ${missing.join(', ')}`;
      },
    },
    {
      id: 'no-text-content',
      description: 'スケルトンは文字を持たない（ロード済みコンテンツと誤認させない）',
      check: ({ root }) => {
        const text = root.textContent?.trim() ?? '';
        return text.length === 0 || `スケルトンに文字が含まれている: "${text.slice(0, 40)}"`;
      },
    },
    {
      id: 'hidden-from-assistive-tech',
      description: 'ルートが aria-hidden（意味のない枠を読み上げさせない）',
      check: ({ root }) => {
        const el = root.querySelector('[data-verify-unit]');
        return (
          el?.getAttribute('aria-hidden') === 'true' ||
          'スケルトンのルート要素に aria-hidden="true" が無い'
        );
      },
    },
  ];
}
