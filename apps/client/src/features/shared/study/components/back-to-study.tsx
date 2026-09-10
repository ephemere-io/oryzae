'use client';

import { verifyAttrs } from '@oryzae/verify';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

/** 垂れ下がるタブの寸法（px）。 */
export const STUDY_EXIT_TAB = { width: 156, height: 28 } as const;

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

/** 帯とタブの色。書斎のラベルの点（`#A8A381`）を地に溶かしたもの。 */
const TINT = '#A8A381';

// CSS カスタムプロパティは React.CSSProperties に含まれないので、`--*` を許す形で広げる。
type TabStyle = React.CSSProperties & Record<`--${string}`, string>;

const TAB_STYLE: TabStyle = {
  width: STUDY_EXIT_TAB.width,
  '--tab-bg': `color-mix(in srgb, ${TINT} 24%, var(--bg))`,
  '--tab-bg-hover': `color-mix(in srgb, ${TINT} 36%, var(--bg))`,
  borderColor: `color-mix(in srgb, ${TINT} 55%, transparent)`,
  color: 'var(--fg)',
};

/**
 * サブ画面の上端に掛かる「書斎へ戻る」。**上端いっぱいの細い帯と、その中央から
 * 垂れ下がるタブ**でできている。
 *
 * **引く動作（`PullBackToStudy`）と同じことを、押しても出来るようにするための双子。**
 * 引きは覚えなくてよい代わりに、そこに在ることが見えない。キャンバスを持たない画面
 * （エントリー）には引きの軸すら無い。だから見える出口も 1 つ要る。
 *
 * ### ここまでの経緯
 *
 * 左上のマーク → 下端の中央 → 上端の中央に浮かせた 9px の名前 → 画面を丸ごと下げる帯
 * → **帯とタブ**。
 *
 * 画面を下げる帯は「帯になっていない・目立たない」と報告された。地がページと同じ色で
 * 線も引いていなかったので、**構造は帯でも、見た目は前の 9px の名前のまま**だった。
 * しかもエントリーでは「設定・日付・問いの行をただ下にずらしただけ」になった。
 *
 * 全幅の帯に高さを持たせると、画面を下げるか画面に重なるかのどちらかしかない。
 * だから**高さを持つのは中央のタブだけ**にして、帯は上端に 3px 走らせる。帯が
 * 「ここは書斎の中の一室」を言い、タブが「ここを押せば戻れる」を言う。
 *
 * - タブの地は書斎のラベルの点の色（`#A8A381`）を溶かしたもの。ページの地から
 *   はっきり浮く色で、しかも書斎の外の語彙を持ち込まない
 * - 名前は 12px（9px は「小さすぎる」と言われている）。矢印は付けない
 *   （「矢印と文字の組み合わせが、どこにも出てないデザイン言語」）— 垂れたタブの形が
 *   そのまま「引けば戻る」を言う
 * - 触れるとタブが 3px 伸びる。引き手を少し引いたときの動き
 *
 * ### 画面の側がすること
 *
 * PC の画面は下がらない。上端の中央 `STUDY_EXIT_RESERVE` だけを空けておく
 * （`--study-exit-reserve`）。どの画面も中央は元から使っておらず、伸びてきたのは
 * エントリーの問いのチップだけだった — あちらは決まった幅の中で横に流れる。
 * SP だけは題を中央に置くので、タブの高さぶん下がる（`--study-exit-band`）。
 *
 * 重なり順は 55。掴んで動かせるパレット（1600）より下で、パレットが裏に隠れて
 * 戻せなくなることは無い。
 */
export function BackToStudy() {
  const t = useTranslations('study');

  return (
    // 帯そのものは触らない。押せるのはタブだけ。
    <div
      {...verifyAttrs({ unit: 'BackToStudy', tabWidth: STUDY_EXIT_TAB.width })}
      className="pointer-events-none fixed inset-x-0 top-0 z-[55] flex justify-center"
    >
      {/* 上端を走る細い帯。 */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[3px]"
        style={{ background: `color-mix(in srgb, ${TINT} 36%, var(--bg))` }}
      />
      <Link
        href="/study"
        aria-label={t('back_to_study')}
        className="pointer-events-auto relative flex h-7 items-center justify-center rounded-b-lg border border-t-0 bg-[var(--tab-bg)] shadow-[0_2px_8px_rgba(74,69,65,0.10)] transition-all duration-200 hover:h-[31px] hover:bg-[var(--tab-bg-hover)]"
        style={TAB_STYLE}
      >
        <span className="whitespace-nowrap text-[12px] font-medium tracking-[0.08em]">
          {t('back_to_study')}
        </span>
      </Link>
    </div>
  );
}
