'use client';

import { verifyAttrs } from '@oryzae/verify';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { LABEL_STYLE } from '../scene/labels';

/**
 * 帯の高さ（px）。**画面はこのぶん下がる。**
 *
 * シェルが `--study-exit-band` に書き、サブ画面はそれを読んで下から始まる。
 * 浮かせて重ねるのをやめた理由は下の注記を参照。
 */
export const STUDY_EXIT_BAND = 34;

/**
 * 画面の上端に敷く「書斎へ戻る」の帯。
 *
 * **引く動作（`PullBackToStudy`）と同じことを、押しても出来るようにするための双子。**
 * 引きは覚えなくてよい代わりに、そこに在ることが見えない。キャンバスを持たない画面
 * （エントリー）には引きの軸すら無い。だから見える出口も 1 つ要る。
 *
 * ### 置き場所は 4 回変えている
 *
 * 左上に固定した 32px のマーク → 下端の中央 → 上端の中央（浮かせて重ねる）→ **上端の帯**。
 *
 * 左上は 3 巡のレビューで毎回指摘された（「既存 UI の邪魔になる」「押せない機能が
 * 発生している」「安直すぎる」）。直し方も毎回同じで、**画面の側に席を空けさせて
 * いた**（`--study-back-inset`）。読む場所は 7 か所まで増え、読み忘れると黙って重なる。
 *
 * 下端の中央は**操作パレットの真下**だった（エントリー 814..876、ボード 810..860）。
 * パレットは掴んで動かせるので、下端はいつでも占領されうる。
 *
 * 上端の中央に浮かせた版でも、**エントリーで問いを 2 つ以上結ぶと重なった**。
 * 問いのチップは左から伸びて中央へ届く。浮かせて重ねるかぎり、伸びる中身がある画面と
 * はいつか必ずぶつかる。
 *
 * ### だから帯にした
 *
 * 帯は画面の一部で、そのぶん下の画面が下がる（`--study-exit-band`）。**重なりようが
 * 無い**のが要点で、これは置き場所の工夫ではなく構造の違い。高さは 34px、地はページと
 * 同じ色で、境目の線は引かない（帯として主張させない）。
 *
 * 重なり順は 55 — エディタ（50）より上で、掴んで動かせるパレット（1600）より下。
 * **パレットが帯の裏に隠れない**ことがここでの条件（一度、下端に生やした帯でパレットが
 * 復活できなくなっている）。
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
 */
export function BackToStudy() {
  const t = useTranslations('study');

  return (
    // 帯そのものは触らない（`pointer-events-none`）。押せるのは名前のところだけで、
    // 帯の左右の余白は下の画面のものではないが、そこを押しても何も起きないほうがよい。
    <div
      {...verifyAttrs({ unit: 'BackToStudy', bandHeight: STUDY_EXIT_BAND })}
      className="pointer-events-none fixed inset-x-0 top-0 z-[55] flex items-center justify-center"
      style={{ height: STUDY_EXIT_BAND, background: 'var(--bg)' }}
    >
      <Link
        href="/study"
        aria-label={t('back_to_study')}
        className="pointer-events-auto flex items-center gap-2 px-3 py-1 opacity-75 transition-all duration-300 hover:translate-y-0.5 hover:opacity-100"
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
    </div>
  );
}
