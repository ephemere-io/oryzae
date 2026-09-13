'use client';

import { verifyAttrs } from '@oryzae/verify';
import { FIELD_CLASS, FIELD_STYLE, type FieldSize } from './surface';

interface InputProps {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  placeholder?: string;
  /** `md` は指の高さ（44px・16px の字）。`sm` は PC の詰めた面。 */
  size?: FieldSize;
  type?: 'text' | 'search';
  className?: string;
  autoFocus?: boolean;
}

/**
 * 1 行の入力欄。**同じ画面に並ぶ `Select` と同じ面**（高さ・角丸・枠・地・フォーカスの輪）。
 *
 * 以前は一覧の検索欄だけが沈んだ灰の別物で、隣のドロップダウンと見た目がばらばらだった
 * （実機レビュー）。shadcn の Input / Select と同じ作法で、面は `surface.ts` の FIELD_* に 1 つ。
 */
export function Input({
  value,
  onChange,
  ariaLabel,
  placeholder,
  size = 'md',
  type = 'text',
  className = 'w-full',
  autoFocus = false,
}: InputProps) {
  return (
    <input
      {...verifyAttrs({ unit: 'Input', size, empty: value.length === 0 })}
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      aria-label={ariaLabel}
      // biome-ignore lint/a11y/noAutofocus: 呼び出し側が「開いた瞬間に打つ欄」と決めたときだけ
      autoFocus={autoFocus}
      className={`${FIELD_CLASS[size]} ${className}`}
      style={FIELD_STYLE}
    />
  );
}
