'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useId } from 'react';
import { CONTROL_FONT } from '@/components/ui/surface';

interface SegmentedOption {
  value: string;
  label: string;
}

interface SegmentedProps {
  value: string;
  options: SegmentedOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
}

/**
 * 選択肢が少ないときの切り替え。**選択肢が全部見えていて、1クリックで決まる**。
 *
 * 縦書きか横書きか、明朝かゴシックか。答えが2つしかない問いに対して、
 * 開いて・見て・選ぶ（2クリック）の Select を使うのは操作を1つ余計に払わせている。
 * 選択肢が3つを超えたら面に畳む（Select）、それ以下なら並べて出す。
 * これがこのアプリで「選ぶ」を出し分ける唯一の基準。
 *
 * 中身は**本物のラジオボタン**。同じ name のラジオ群は矢印キーでの移動・タブ順の
 * まとめ方をブラウザが正しく持っているので、そこを自前で書き直さない。
 * 見た目だけを差し替える（input は視覚的に隠し、隣の span を塗る）。
 */
export function Segmented({ value, options, onChange, ariaLabel, className = '' }: SegmentedProps) {
  const name = useId();

  return (
    <fieldset
      className={`flex h-7 items-center gap-0.5 rounded-md border-0 p-0.5 ${className}`}
      style={{ backgroundColor: 'var(--track)', ...CONTROL_FONT }}
      {...verifyAttrs({ unit: 'Segmented', value, optionCount: options.length })}
    >
      <legend className="sr-only">{ariaLabel}</legend>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <label
            key={option.value}
            className="flex h-6 flex-1 cursor-pointer items-center justify-center rounded-[5px] px-2.5 text-[12px] whitespace-nowrap transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-[var(--accent)]"
            style={
              selected
                ? {
                    backgroundColor: 'var(--surface-raised)',
                    color: 'var(--fg)',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.10)',
                  }
                : { color: 'var(--date-color)' }
            }
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={selected}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        );
      })}
    </fieldset>
  );
}
