'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { CONTROL_FONT } from './surface';

export interface RowAction {
  /** `data-row-action` に出す（検証・テストの手掛かり）。 */
  id: string;
  label: string;
  /**
   * - `primary`: いちばん押してほしい操作（塗り）
   * - `secondary`: やめる・閉じる（枠）
   * - `danger`: 取り返しのつく破壊的な操作（暖色の枠）。**右端へ寄せる**
   */
  tone: 'primary' | 'secondary' | 'danger';
  onSelect?: () => void;
  /** 押すと画面を移る操作。 */
  href?: string;
  disabled?: boolean;
  icon?: ReactNode;
}

/**
 * シートや選び手の**操作の 1 行**。保存・キャンセル・アーカイブのように性質が同じ操作を 1 か所に固める。
 *
 * **左上中心主義**（オーナーの指示）: いちばん押してほしい操作を左に、押されたくない操作を右に置く。並びは
 * `actions` の順（優先の高い順）で、`danger` は右端へ寄せる。以前は保存が見出しの右端、アーカイブが中身の下、
 * と操作が散っていて、押してほしい順と場所が合っていなかった（実機レビュー）。
 *
 * 高さ・角丸・字はすべて同じ（見出しの「閉じる」とも同じ）。違うのは色だけ。
 */
export function ActionRow({ actions }: { actions: readonly RowAction[] }) {
  const firstDanger = actions.findIndex((action) => action.tone === 'danger');
  return (
    <div className="flex flex-wrap items-center gap-2" style={CONTROL_FONT}>
      {actions.map((action, index) => {
        // アイコンは字の高さに揃える（パレットのアイコンをそのまま渡しても大きくならない）。
        const className = `flex min-h-[40px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-4 text-[13px] disabled:opacity-40 [&_svg]:h-4 [&_svg]:w-4 ${
          action.tone === 'primary' ? 'font-medium' : ''
        } ${index === firstDanger ? 'ms-auto' : ''}`;
        const style =
          action.tone === 'primary'
            ? { color: 'var(--bg)', background: 'var(--accent)', borderColor: 'var(--accent)' }
            : action.tone === 'danger'
              ? {
                  color: 'var(--ob-jar-warm)',
                  borderColor: 'color-mix(in srgb, var(--ob-jar-warm) 35%, transparent)',
                }
              : { color: 'var(--fg)', borderColor: 'var(--border-subtle)' };
        if (action.href && !action.disabled) {
          return (
            <Link
              key={action.id}
              href={action.href}
              data-row-action={action.id}
              className={className}
              style={style}
            >
              {action.icon}
              {action.label}
            </Link>
          );
        }
        return (
          <button
            key={action.id}
            type="button"
            data-row-action={action.id}
            disabled={action.disabled}
            onClick={action.onSelect}
            className={className}
            style={style}
          >
            {action.icon}
            {action.label}
          </button>
        );
      })}
    </div>
  );
}
