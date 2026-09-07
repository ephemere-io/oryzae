'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';

export interface StudyWordTooltipProps {
  /** 触れている語。null なら出さない。 */
  word: string | null;
  /** その語が出てきた問い。消された問いなら null。 */
  question: string | null;
  /** 貼り付ける画面座標。 */
  screen: { x: number; y: number };
}

/**
 * 瓶の中の語に触れたときに出す、出どころの問い。
 *
 * 語だけが漂っていると「**何を指すのか推測しづらい**」と実機レビューで報告された。
 * 語は発酵の結果であって、それ単体では文脈を持たない。触れたときに「どの問いから
 * 出てきたか」を返すのが、いちばん短い説明になる。
 *
 * 手帳のツールチップ（`StudyTooltip`）と分けてあるのは、出すものが違うから。
 * あちらは「その冊に何が入っているか」（件数と日付の範囲）で、こちらは
 * 「この語がどこから来たか」。同じ枠に押し込むと、どちらの説明も痩せる。
 *
 * **問いが消えていても語は出す。** 消された問いから出た語でも、瓶の中で発酵したことに
 * 変わりはない。出どころを出せないことだけを伝える。
 */
export function StudyWordTooltip({ word, question, screen }: StudyWordTooltipProps) {
  const t = useTranslations('study');
  if (word === null) return null;

  return (
    <div
      {...verifyAttrs({ unit: 'StudyWordTooltip', hasQuestion: question !== null })}
      className="pointer-events-none absolute max-w-[240px] rounded-md px-3 py-2"
      style={{
        left: screen.x,
        top: screen.y,
        transform: 'translate(-50%, -100%)',
        background: '#fdfbf7',
        border: '1px solid rgba(122,116,64,0.18)',
        boxShadow: '0 4px 18px rgba(140,133,126,0.16)',
      }}
    >
      <div className="text-[11px]" style={{ color: '#5C4F3F', fontFamily: 'var(--ob-font-serif)' }}>
        {word}
      </div>
      <div className="mt-1 text-[10px] leading-relaxed" style={{ color: '#8C857E' }}>
        {question ?? t('word_question_gone')}
      </div>
    </div>
  );
}
