'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';

export interface StudyHintTooltipProps {
  /** `study` 配下の鍵（`hint_pen` など）。 */
  textKey: string;
  /** 貼り付ける画面座標。 */
  screen: { x: number; y: number };
}

/**
 * ラベルを持たない的に触れたとき、押すと何が起きるかを一言で出す。
 *
 * 瓶・手帳・板・棚は自分の名前（`JAR` / `JOURNAL` / …）を持っていて、ホバーで濃くなる。
 * **鉛筆にはそれを持たせられない** — 積みのすぐ脇にあるので、`JOURNAL` の隣にもう 1 つ
 * 注釈が出ると、どちらがどの物の名前か読めなくなる。代わりに、触れたときだけ出す。
 *
 * 手帳のツールチップ（`StudyTooltip`）と分けてあるのは、出すものが違うから。
 * あちらは「その冊に何が入っているか」で、こちらは「押すと何が起きるか」。
 */
export function StudyHintTooltip({ textKey, screen }: StudyHintTooltipProps) {
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
      {t(textKey)}
    </div>
  );
}
