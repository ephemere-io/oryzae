'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useId } from 'react';
import { CONTROL_FONT, type FieldSize } from '@/components/ui/surface';

interface SegmentedOption {
  value: string;
  label: string;
}

interface SegmentedProps {
  value: string;
  options: SegmentedOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  /** sm: PC のパネル向け（28px）。md: 指で押す（40px、SP のシート）。 */
  size?: FieldSize;
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
const SIZE = {
  sm: { fieldset: 'h-7 rounded-md', label: 'h-6 rounded-[5px] px-2.5 text-[12px]' },
  md: { fieldset: 'h-10 rounded-lg', label: 'h-9 rounded-[7px] px-3 text-[13px]' },
} as const;

export function Segmented({
  value,
  options,
  onChange,
  ariaLabel,
  size = 'sm',
  className = '',
}: SegmentedProps) {
  const name = useId();
  const sizing = SIZE[size];

  return (
    <fieldset
      className={`flex items-center gap-0.5 border-0 p-0.5 ${sizing.fieldset} ${className}`}
      style={{ backgroundColor: 'var(--track)', ...CONTROL_FONT }}
      {...verifyAttrs({ unit: 'Segmented', value, size, optionCount: options.length })}
    >
      <legend className="sr-only">{ariaLabel}</legend>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <label
            key={option.value}
            className={`flex flex-1 cursor-pointer items-center justify-center whitespace-nowrap transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-[var(--accent)] ${sizing.label}`}
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
