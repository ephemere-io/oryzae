'use client';

import { verifyAttrs } from '@oryzae/verify';
import { FLAT_TRACK_CLASS, FLAT_TRACK_STYLE, SEGMENT_CLASS } from './board-surface';

interface BoardViewSwitchProps {
  viewType: 'daily' | 'weekly';
  onViewTypeChange: (viewType: 'daily' | 'weekly') => void;
}

const VIEW_TYPES: { id: 'daily' | 'weekly'; label: string }[] = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
];

/**
 * 盤面右上の表示単位切り替え（Daily / Weekly）。
 *
 * 日付ナビ（左上）とは別パーツにしている。どちらも viewType を見るが、左上は
 * 「いつを見ているか」の表示と前後移動、こちらは「どの粒度で見るか」の選択で、
 * 画面上の役割が違う。作成系の道具は下部の BoardToolbar が持つ。
 */
export function BoardViewSwitch({ viewType, onViewTypeChange }: BoardViewSwitchProps) {
  return (
    <div
      {...verifyAttrs({ unit: 'BoardViewSwitch', viewType })}
      // ロールは付けない。各ボタンが "Daily" / "Weekly" と自己説明的で aria-pressed も
      // 持つため、group を足すと fieldset/legend を要求されるだけで読み上げは良くならない。
      // これは「行為」ではなく「状態」の選択なので、浮かせない。盤面に沈んだ溝として
      // 描き、道具箱（浮いた面）と役割を見た目で分ける。
      className={`${FLAT_TRACK_CLASS} right-6 top-5`}
      style={FLAT_TRACK_STYLE}
    >
      {VIEW_TYPES.map((v) => {
        const isActive = viewType === v.id;
        return (
          <button
            key={v.id}
            type="button"
            onClick={() => onViewTypeChange(v.id)}
            aria-pressed={isActive}
            data-verify-view-option={v.id}
            // 非選択側だけ hover を効かせる。インライン style は :hover に勝つので
            // backgroundColor は非選択時に指定しない。
            className={`${SEGMENT_CLASS} ${isActive ? '' : 'hover:text-[var(--fg)]'}`}
            style={
              isActive
                ? { backgroundColor: 'var(--accent)', color: '#fff' }
                : { color: 'var(--date-color)' }
            }
          >
            {v.label}
          </button>
        );
      })}
    </div>
  );
}
