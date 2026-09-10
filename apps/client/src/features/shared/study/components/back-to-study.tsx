'use client';

import { verifyAttrs } from '@oryzae/verify';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { LABEL_STYLE } from '../scene/labels';

/**
 * 画面の下端に置く「書斎へ戻る」。
 *
 * **引く動作（`PullBackToStudy`）と同じことを、押しても出来るようにするための双子。**
 * 引きは覚えなくてよい代わりに、そこに在ることが見えない。キャンバスを持たない画面
 * （エントリー）には引きの軸すら無い。だから見える出口も 1 つ要る。
 *
 * ### なぜ左上をやめたか
 *
 * 以前は左上に固定した 32px のマークだった。3 巡のレビューで毎回ここが指摘されている
 * （「既存 UI の邪魔になる」「押せない機能が発生している」「安直すぎる」）。直し方も
 * 毎回同じで、**画面の側に席を空けさせていた**（`--study-back-inset`）。席を読む場所は
 * 7 か所まで増え、読み忘れると黙って重なる。左上はどの画面も自分のヘッダーに使いたい
 * 場所で、そこを共有物が占め続ける限りこの往復は終わらない。**席を配るのをやめた。**
 *
 * ### なぜ下端でもないか
 *
 * 次に下端の中央へ置いたが、そこは**操作パレットの真下**だった（エントリーは
 * 814..876、ボードは 810..860）。24px の帯に押し込むことになり、「パレットと被りそう」
 * 「見にくい」と報告された。パレットは掴んで動かせるので、下端はいつでも占領されうる。
 *
 * **上端の中央にした。** どの画面もそこだけは空けている — ヘッダーは左に自分の見出し
 * （問いのチップ・日付）、右に自分の操作（設定・DAILY/WEEKLY・問いの変遷）を置き、
 * 中央は誰も使っていない。
 *
 * ### なぜ箱に入れないか
 *
 * 擦りガラスのピルに入れた版は「ダサい」と報告された。**あれは汎用の操作チップの形**で、
 * この製品の言葉ではない。書斎の中で行き先を名乗っているのは「3px の点 + 9px の機械
 * ラベル」（`LABEL_STYLE`）で、これがこの部屋の書体そのもの。出口にも同じ書体を使えば、
 * 箱を足さずに**部屋の気配**で「あちらへ戻れる」と言える。
 *
 * 点の代わりに細い山形を置いているのは、点のままだと部屋の中の的（`• JAR` `• BOARD`）と
 * 同じ見た目になり「ここが STUDY だ」と読めてしまうから。**上向き**にして「ここから
 * 上へ抜ける」にする（引きの出口と同じ「離れる」向き）。
 *
 * 常時は 0.75、触れると 1.0 になってわずかに浮く。薄い印だけを置いて名前をホバーで
 * 開く形にしていたころは**下端で見落とされた**（実機の指摘）ので、名前は常時出す。
 */
export function BackToStudy() {
  const t = useTranslations('study');

  return (
    <Link
      href="/study"
      {...verifyAttrs({ unit: 'BackToStudy' })}
      aria-label={t('back_to_study')}
      // 上端の中央。ヘッダーは左に見出し、右に操作を置いていて、中央だけが空いている
      // （エントリーは問いのチップと設定、ボードは日付と DAILY/WEEKLY、瓶は問いの変遷）。
      // 重なり順はサブ画面の浮きものと同じ 55（エディタの 50 より上、モーダルの 60 より下）。
      className="-translate-x-1/2 fixed top-3 left-1/2 z-[55] flex items-center gap-2 opacity-75 transition-all duration-300 hover:translate-y-0.5 hover:opacity-100"
    >
      {/* 細い山形ひとつ。**箱も下線も付けない** — 線 1 本で「ここから抜ける」に足りる。 */}
      <svg
        aria-hidden="true"
        width="13"
        height="7"
        viewBox="0 0 13 7"
        fill="none"
        style={{ color: LABEL_STYLE.dotColor }}
      >
        <path
          d="M1.5 5.5 L6.5 1.5 L11.5 5.5"
          stroke="currentColor"
          strokeWidth="1.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span
        className="whitespace-nowrap"
        style={{
          fontSize: LABEL_STYLE.fontSize,
          letterSpacing: LABEL_STYLE.letterSpacing,
          color: LABEL_STYLE.color,
        }}
      >
        {t('back_to_study')}
      </span>
    </Link>
  );
}
