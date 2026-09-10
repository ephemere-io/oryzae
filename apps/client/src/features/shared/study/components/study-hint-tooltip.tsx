'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';

export interface StudyHintTooltipProps {
  /** `study` 配下の鍵（`hint_pen` など）。 */
  textKey: string;
  /** ICU に差し込む数（「写真 3 件」の 3）。数を持たない鍵もある。 */
  values?: Record<string, number>;
  /** 貼り付ける画面座標。 */
  screen: { x: number; y: number };
}

/**
 * 的に触れたとき、そこに何があるかを一言で出す。
 *
 * ラベル（`JAR` / `BOARD` / …）は**名前しか言わない**。名前だけでは中に何が
 * 貼ってあるか開くまで分からず、実機レビューで「ボードにホバーしても何も出ない」と
 * 報告された。鉛筆はそもそもラベルを持てない（積みの隣に 2 つ目の注釈が出ると、
 * どちらがどの物の名前か読めなくなる）ので、こちらが唯一の予告になる。
 *
 * 手帳のツールチップ（`StudyTooltip`）と分けてあるのは、出すものが違うから。
 * あちらは月と件数と日付の範囲を並べる紙で、こちらは 1 行。
 * 文面を決めるのは `hints.ts`（純関数）で、ここは描くだけ。
 */
export function StudyHintTooltip({ textKey, values, screen }: StudyHintTooltipProps) {
  const t = useTranslations('study');

  return (
    <div
      {...verifyAttrs({ unit: 'StudyHintTooltip', textKey })}
      className="pointer-events-none absolute whitespace-nowrap rounded-md px-3 py-1.5 text-[10px]"
      style={{
        left: screen.x,
        top: screen.y,
        transform: 'translate(-50%, -100%)',
        background: '#fdfbf7',
        border: '1px solid rgba(122,116,64,0.18)',
        boxShadow: '0 4px 18px rgba(140,133,126,0.16)',
        color: '#5C4F3F',
      }}
    >
      {t(textKey, values)}
    </div>
  );
}
