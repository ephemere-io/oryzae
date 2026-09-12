'use client';

import { verifyAttrs } from '@oryzae/verify';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  ELEVATED_CHIP_CLASS,
  ELEVATED_CHIP_STYLE,
  SHELL_ROW_HEIGHT,
} from '@/components/ui/surface';
import { useSidebarVisibility } from '@/lib/sidebar-context';

/** タブ（チップ）の寸法（px）。上端から垂れるときも、下端の帯に載るときも同じ。 */
export const STUDY_EXIT_TAB = { width: 156, height: 32 } as const;

/**
 * PC の画面が上端の中央に空けておく幅（px）。タブの幅に左右の息継ぎを足したもの。
 *
 * シェルが `--study-exit-reserve` に書く。**画面は下がらない** — 中央のこの幅だけを
 * 空ければよい（エントリーのヘッダーは 3 列にして真ん中をこの幅にしている）。
 */
export const STUDY_EXIT_RESERVE = STUDY_EXIT_TAB.width + 32;

/**
 * SP の画面が**下端に**空ける高さ（px）。下端の帯の高さで、外枠の行の高さ
 * （`SHELL_ROW_HEIGHT`）と同じ線に乗せる。ホームインジケータぶん（safe-area）は
 * シェルがこれに足す。
 */
export const STUDY_EXIT_BAND = SHELL_ROW_HEIGHT;

/** どの縁に掛けるか。端末の判断はシェル（`(protected)/layout.tsx`）が持つ。 */
export type StudyExitPlacement = 'top' | 'bottom';

interface BackToStudyProps {
  /**
   * PC は上端の中央から垂れるタブ（既定）。SP は下端の帯に載るチップ。
   *
   * SP で上端に置いていたころは、SP のヘッダーが題を中央に置くのでタブの真下に題が来て、
   * 画面を 32px 下げていた。下げたぶんの帯は素の地色で境界が無く、タブが空中に浮いて
   * 見えると報告された。親指の届く下端に、面（帯）ごと移す。
   */
  placement?: StudyExitPlacement;
}

/**
 * サブ画面の縁に掛かる「書斎へ戻る」。
 *
 * **引く動作（`PullBackToStudy`）と同じことを、押しても出来るようにするための双子。**
 * 引きは覚えなくてよい代わりに、そこに在ることが見えない。キャンバスを持たない画面
 * （エントリー）には引きの軸すら無い。だから見える出口も 1 つ要る。
 *
 * ### ここまでの経緯
 *
 * 左上のマーク → 下端の中央 → 上端の中央に浮かせた 9px の名前 → 画面を丸ごと下げる帯
 * → 帯とタブ（書斎のラベルの色を溶かした地）→ 帯とタブ（パレットと同じ面）
 * → **PC は上端のタブ、SP は下端の帯に載るチップ**。
 *
 * PC で全幅の帯に高さを持たせると、画面を下げるか画面に重なるかしかない。だから中央の
 * タブだけにした。SP は事情が逆で、上端に置くと題と競り合い、素の地色の帯は境界が無い。
 * 下端なら帯は「沈んだ面」（一段暗い地 + 境界線 1 本）としてそのまま意味を持ち、
 * 画面はそのぶん上で終わる（被らない）。
 *
 * - **面はアクションパレットと同じ**（地・縁・角丸・ホバー。`ELEVATED_CHIP_*`）。
 *   書斎の色を溶かした専用の地にしていたころ、問いのチップ・パレット・瓶の問いと
 *   角丸も色も違い、同じアプリの部品に見えないと報告された。**影は付けない**
 *   （付けた版は「見にくい・気持ち悪い」と言われた）
 * - **縁は 4 辺とも付ける。** 上端に貼りついているので上の縁だけ外していたが、
 *   上側にも付けてほしいと言われた（実機レビュー）。角を丸めないのは上端のときの上の 2 つだけで、
 *   下端の帯に載るときは四隅を丸める
 * - 名前は 12px（9px は「小さすぎる」と言われている）。矢印は付けない
 * - ホバーは地が沈むだけ（パレットと同じ）。伸びる動きはやめた
 * - **集中モードでは消える。** エディタが書いている間にサイドバーを隠す合図
 *   （`useSidebarVisibility().hidden`）をそのまま読む
 *
 * ### 画面の側がすること
 *
 * PC の画面は下がらない。上端の中央 `STUDY_EXIT_RESERVE` だけを空けておく
 * （`--study-exit-reserve`）。SP は下端に `STUDY_EXIT_BAND` + safe-area を空ける
 * （`--study-exit-band`）。
 *
 * 重なり順は 55。掴んで動かせるパレット（1600）より下で、パレットが裏に隠れて
 * 戻せなくなることは無い。
 */
export function BackToStudy({ placement = 'top' }: BackToStudyProps) {
  const t = useTranslations('study');
  // 集中モード（エディタが書いている間にまわりを消す）。サイドバーと同じ合図で退く。
  const { hidden } = useSidebarVisibility();
  const bottom = placement === 'bottom';

  return (
    // 帯そのものは触らない。押せるのはタブだけ。
    <div
      {...verifyAttrs({ unit: 'BackToStudy', tabWidth: STUDY_EXIT_TAB.width, hidden, placement })}
      className={`pointer-events-none fixed inset-x-0 z-[55] flex justify-center transition-opacity duration-300 ${
        bottom ? 'bottom-0 items-center' : 'top-0'
      } ${hidden ? 'opacity-0' : 'opacity-100'}`}
      style={
        bottom
          ? {
              // 沈んだ面。画面はこの帯の上で終わる（シェルが同じ高さを空ける）ので、
              // 帯の下に潜るものは無い。
              height: `calc(${STUDY_EXIT_BAND}px + env(safe-area-inset-bottom, 0px))`,
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
              background: 'var(--surface-sunken)',
              borderTop: '1px solid var(--surface-sunken-border)',
            }
          : undefined
      }
    >
      <Link
        href="/"
        aria-label={t('back_to_study')}
        // 消えている間は押せず、Tab でも止まらない（見えないものに当たらせない）。
        tabIndex={hidden ? -1 : undefined}
        aria-hidden={hidden || undefined}
        className={`${hidden ? 'pointer-events-none' : 'pointer-events-auto'} relative flex h-8 items-center justify-center ${ELEVATED_CHIP_CLASS}`}
        style={{
          ...ELEVATED_CHIP_STYLE,
          width: STUDY_EXIT_TAB.width,
          // 上端に貼りついているときは、角を丸めるのは下の 2 つだけ。帯に載るときは四隅。
          ...(bottom ? {} : { borderTopLeftRadius: 0, borderTopRightRadius: 0 }),
        }}
      >
        <span className="whitespace-nowrap text-[12px] font-medium tracking-[0.08em]">
          {t('back_to_study')}
        </span>
      </Link>
    </div>
  );
}
