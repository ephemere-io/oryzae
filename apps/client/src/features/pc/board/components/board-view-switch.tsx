'use client';

import { verifyAttrs } from '@oryzae/verify';
import {
  FLAT_TRACK_CLASS,
  FLAT_TRACK_STYLE,
  SEGMENT_ACTIVE_STYLE,
  SEGMENT_CLASS,
  SEGMENT_IDLE_STYLE,
} from './board-surface';

interface BoardViewSwitchProps {
  viewType: 'daily' | 'weekly';
  onViewTypeChange: (viewType: 'daily' | 'weekly') => void;
}

const VIEW_TYPES: { id: 'daily' | 'weekly'; label: string }[] = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
];

/**
 * 表示単位の切り替え（Daily / Weekly）。左上で日付ナビの隣に並ぶ。
 *
 * 日付ナビとは別パーツのままにしている。どちらも viewType を見るが、あちらは
 * 「いつを見ているか」の表示と前後移動、こちらは「どの粒度で見るか」の選択で、
 * 役割が違うので重さも変える（あちらは文字だけ、こちらは沈んだ溝）。
 * ただし置き場は隣り合わせにする——これを押すと隣の日付表示が 1 日から週レンジへ
 * 変わるので、離れていると何が起きたのか目で追えない。
 */
export function BoardViewSwitch({ viewType, onViewTypeChange }: BoardViewSwitchProps) {
  return (
    <div
      {...verifyAttrs({ unit: 'BoardViewSwitch', viewType })}
      // ロールは付けない。各ボタンが "Daily" / "Weekly" と自己説明的で aria-pressed も
      // 持つため、group を足すと fieldset/legend を要求されるだけで読み上げは良くならない。
      // これは「行為」ではなく「状態」の選択なので、浮かせない。盤面に沈んだ溝として
      // 描き、道具箱（浮いた面）と役割を見た目で分ける。
      className={FLAT_TRACK_CLASS}
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
            style={isActive ? SEGMENT_ACTIVE_STYLE : SEGMENT_IDLE_STYLE}
          >
            {v.label}
          </button>
        );
      })}
    </div>
  );
}
