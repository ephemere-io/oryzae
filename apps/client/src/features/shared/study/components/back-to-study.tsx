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
 * 場所で、そこを共有物が占め続ける限りこの往復は終わらない。**席を配るのをやめ、
 * 誰も使っていない下端へ移した。**
 *
 * ### なぜ箱に入れないか
 *
 * 擦りガラスのピルに入れた版は「ダサい」と報告された。**あれは汎用の操作チップの形**で、
 * この製品の言葉ではない。書斎の中で行き先を名乗っているのは「3px の点 + 9px の機械
 * ラベル」（`LABEL_STYLE`）で、これがこの部屋の書体そのもの。出口にも同じ書体を使えば、
 * 箱を足さずに**部屋の気配**で「あちらへ戻れる」と言える。
 *
 * 点の代わりに細い山形を置いているのは、点のままだと部屋の中の的（`• JAR` `• BOARD`）と
 * 同じ見た目になり「ここが STUDY だ」と読めてしまうから。向きを持たせて「ここから
 * 出る」にする。
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
      // 下端の縁の中央。左右の隅はどの画面も自分の操作に使っていて（倍率・ミニマップ・
      // 保存状態・文字数）、中央も少し上には浮かぶパレット（エントリー 814..876）と
      // ツールバー（ボード 810..860）がいる。空いているのは 876..900 の帯だけ。
      // 重なり順はサブ画面の浮きものと同じ 55（エディタの 50 より上、モーダルの 60 より下）。
      className="-translate-x-1/2 fixed bottom-2 left-1/2 z-[55] flex items-center gap-2 opacity-75 transition-all duration-300 hover:-translate-y-0.5 hover:opacity-100"
    >
      {/* 細い山形ひとつ。**箱も下線も付けない** — 線 1 本で「ここから下へ抜ける」に足りる。 */}
      <svg
        aria-hidden="true"
        width="13"
        height="7"
        viewBox="0 0 13 7"
        fill="none"
        style={{ color: LABEL_STYLE.dotColor }}
      >
        <path
          d="M1.5 1.5 L6.5 5.5 L11.5 1.5"
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
