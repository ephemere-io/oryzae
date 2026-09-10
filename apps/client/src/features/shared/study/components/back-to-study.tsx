'use client';

import { verifyAttrs } from '@oryzae/verify';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ELEVATED_CHIP_CLASS, ELEVATED_CHIP_STYLE } from '@/components/ui/surface';
import { useSidebarVisibility } from '@/lib/sidebar-context';

/** 垂れ下がるタブの寸法（px）。 */
export const STUDY_EXIT_TAB = { width: 156, height: 32 } as const;

/**
 * PC の画面が上端の中央に空けておく幅（px）。タブの幅に左右の息継ぎを足したもの。
 *
 * シェルが `--study-exit-reserve` に書く。**画面は下がらない** — 中央のこの幅だけを
 * 空ければよい（エントリーのヘッダーは 3 列にして真ん中をこの幅にしている）。
 */
export const STUDY_EXIT_RESERVE = STUDY_EXIT_TAB.width + 32;

/**
 * SP の画面が下がる高さ（px）。SP のヘッダーは題を中央に置くので、タブの真下に
 * 題が来る。SP だけはタブの高さぶん画面を下げる。
 */
export const STUDY_EXIT_BAND = STUDY_EXIT_TAB.height;

/**
 * サブ画面の上端の中央に垂れ下がる「書斎へ戻る」のタブ。
 *
 * **引く動作（`PullBackToStudy`）と同じことを、押しても出来るようにするための双子。**
 * 引きは覚えなくてよい代わりに、そこに在ることが見えない。キャンバスを持たない画面
 * （エントリー）には引きの軸すら無い。だから見える出口も 1 つ要る。
 *
 * ### ここまでの経緯
 *
 * 左上のマーク → 下端の中央 → 上端の中央に浮かせた 9px の名前 → 画面を丸ごと下げる帯
 * → 帯とタブ（書斎のラベルの色を溶かした地）→ **帯とタブ（パレットと同じ面）**。
 *
 * 全幅の帯に高さを持たせると、画面を下げるか画面に重なるかしかない。だから中央の
 * タブだけにした。上端いっぱいに走らせていた 3px の帯も「いらない」と言われて外した。
 *
 * - **面はアクションパレットと同じ**（地・縁・角丸・ホバー。`ELEVATED_CHIP_*`）。
 *   書斎の色を溶かした専用の地にしていたころ、問いのチップ・パレット・瓶の問いと
 *   角丸も色も違い、同じアプリの部品に見えないと報告された。**影は付けない**
 *   （付けた版は「見にくい・気持ち悪い」と言われた）
 * - 名前は 12px（9px は「小さすぎる」と言われている）。矢印は付けない
 * - ホバーは地が沈むだけ（パレットと同じ）。伸びる動きはやめた
 * - **集中モードでは消える。** エディタが書いている間にサイドバーを隠す合図
 *   （`useSidebarVisibility().hidden`）をそのまま読む
 *
 * ### 画面の側がすること
 *
 * PC の画面は下がらない。上端の中央 `STUDY_EXIT_RESERVE` だけを空けておく
 * （`--study-exit-reserve`）。SP だけは題を中央に置くので、タブの高さぶん下がる
 * （`--study-exit-band`）。
 *
 * 重なり順は 55。掴んで動かせるパレット（1600）より下で、パレットが裏に隠れて
 * 戻せなくなることは無い。
 */
export function BackToStudy() {
  const t = useTranslations('study');
  // 集中モード（エディタが書いている間にまわりを消す）。サイドバーと同じ合図で退く。
  const { hidden } = useSidebarVisibility();

  return (
    // 帯そのものは触らない。押せるのはタブだけ。
    <div
      {...verifyAttrs({ unit: 'BackToStudy', tabWidth: STUDY_EXIT_TAB.width, hidden })}
      className={`pointer-events-none fixed inset-x-0 top-0 z-[55] flex justify-center transition-opacity duration-300 ${
        hidden ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <Link
        href="/"
        aria-label={t('back_to_study')}
        // 消えている間は押せず、Tab でも止まらない（見えないものに当たらせない）。
        tabIndex={hidden ? -1 : undefined}
        aria-hidden={hidden || undefined}
        className={`${hidden ? 'pointer-events-none' : 'pointer-events-auto'} relative flex h-8 items-center justify-center border-t-0 ${ELEVATED_CHIP_CLASS}`}
        style={{
          ...ELEVATED_CHIP_STYLE,
          width: STUDY_EXIT_TAB.width,
          // 上端に貼りついているので、角を丸めるのは下の 2 つだけ。
          borderTopLeftRadius: 0,
          borderTopRightRadius: 0,
        }}
      >
        <span className="whitespace-nowrap text-[12px] font-medium tracking-[0.08em]">
          {t('back_to_study')}
        </span>
      </Link>
    </div>
  );
}
