'use client';

import { verifyAttrs } from '@oryzae/verify';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

/**
 * 画面の下端に小さく浮く「書斎へ戻る」。
 *
 * **引く動作（`PullBackToStudy`）と同じことを、押しても出来るようにするための双子。**
 * 引きは覚えなくてよい代わりに、そこに在ることが見えない。キャンバスを持たない画面
 * （エントリー）には引きの軸すら無い。だから見える出口も 1 つ要る。
 *
 * ### なぜ左上をやめたか
 *
 * 以前は左上に固定した 32px のマークだった。3 巡のレビューで毎回ここが指摘されている:
 *
 *  1. 「ボード / エントリー / 瓶で既存 UI の邪魔になる」
 *  2. 「エントリー画面などで押せない機能が発生している」
 *  3. 「右上に来ている（＝どれが戻る導線か読めない）」「安直すぎる」
 *
 * 直し方も毎回同じで、**画面の側に席を空けさせていた**（`--study-back-inset`）。
 * 席を読む場所は 7 か所まで増え、読み忘れると黙って重なる。実際 3 回忘れられている。
 * 左上はどの画面も自分のヘッダーに使いたい場所で、そこを共有物が占め続ける限り、
 * この往復は終わらない。**席を配るのをやめ、誰も使っていない下端へ移した。**
 *
 * ### 形
 *
 * 下向きの山形と名前。**この画面から下へ抜ける**という意味で、押すと部屋へ戻る。
 *
 * はじめは印だけを薄く置き、名前はホバーで開いていた。**下端で見落とされた**
 * （実機の指摘）。触れてみるまで何なのか分からないものは、隅では気づかれない。
 * 縦に使える幅は 24px しか無い（パレットの底 876 と画面の下端 900 のあいだ）ので、
 * 目立たせるぶんは**横と濃さ**で稼ぐ — 名前を常時出し、他の浮きものと同じ擦りガラスを
 * 敷いた。横へ伸びるぶんには誰とも取り合わない。
 */
export function BackToStudy() {
  const t = useTranslations('study');

  return (
    <Link
      href="/study"
      {...verifyAttrs({ unit: 'BackToStudy' })}
      aria-label={t('back_to_study')}
      // **下端の縁の中央。** 左右の隅はどの画面も自分の操作に使っている（ボードと瓶は
      // 倍率とミニマップ、エントリーは保存状態と文字数）。中央も、少し上には浮かぶ
      // 操作パレット（エントリー 814..876）とツールバー（ボード 810..860）がいる。
      // 空いているのは**いちばん下の縁だけ**なので、そこへ寝かせる。
      //
      // **縦に使える幅は 24px しか無い**（パレットの底 876 と画面の下端 900 のあいだ）。
      // だから目立たせるぶんは横と濃さで稼ぐ — 名前を常時出し、他の浮きものと同じ
      // 擦りガラスを敷く。「薄い印が 1 つ」だと下端で見落とされる（実機の指摘）。
      // 重なり順はサブ画面の浮きものと同じ 55（エディタの 50 より上、モーダルの 60 より下）。
      className="-translate-x-1/2 fixed bottom-1 left-1/2 z-[55] flex items-center gap-1.5 rounded-full px-3 py-0.5 opacity-80 transition-opacity duration-300 hover:opacity-100"
      style={glass}
    >
      {/* 山形の下に横線を 1 本。**ただの山形にはしない** — エントリーの操作パレットは
          すぐ上にいて、その右端が「パレットを畳む」の山形を持っている。同じ絵が近くに
          2 つ並ぶと、どちらがどちらか読めない。線を足すと「ここから下へ抜ける」になる。 */}
      <svg
        aria-hidden="true"
        width="16"
        height="13"
        viewBox="0 0 16 13"
        fill="none"
        style={{ color: '#5C4F3F' }}
      >
        <path
          d="M3 2 L8 7 L13 2"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M3.5 10.5 H12.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
      {/* 名前は常時出す。ホバーで開く形にしていたが、**触れてみるまで何なのか分からない**
          ので下端で見落とされた。横に伸びるぶんには誰とも取り合わない。 */}
      <span
        className="whitespace-nowrap text-[9px] uppercase tracking-[0.18em]"
        style={{ color: '#5C4F3F' }}
      >
        {t('back_to_study')}
      </span>
    </Link>
  );
}

/** 浮かせる要素に共通の擦りガラス（`StudyChrome` と同じ）。 */
const glass: React.CSSProperties = {
  background: 'rgba(253, 251, 247, 0.72)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  border: '1px solid rgba(122, 116, 64, 0.18)',
  boxShadow: '0 2px 12px rgba(140, 133, 126, 0.14)',
};
