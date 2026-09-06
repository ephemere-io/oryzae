'use client';

import { Tooltip as TooltipPrimitive } from 'radix-ui';
import type { ReactNode } from 'react';

interface TooltipProps {
  /** ホバー/フォーカスの対象。 */
  children: ReactNode;
  /** 吹き出しの中身。 */
  content: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
}

/**
 * ホバーで補足を出す吹き出し。
 *
 * Provider を内側に持たせているのは、1 個だけ使いたい場所（テーブルのセル等）で
 * ルートに Provider を足す必要をなくすため。入れ子になっても Radix 側で問題ない。
 *
 * `delayDuration=150` は「触れた瞬間に出ない／待たされない」の中間。既定の 700ms は
 * 判定基準を確かめたいだけの用途には遅すぎる。
 */
export function Tooltip({ children, content, side = 'top' }: TooltipProps) {
  return (
    <TooltipPrimitive.Provider delayDuration={150}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            sideOffset={6}
            className="z-50 max-w-xs rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs leading-relaxed text-popover-foreground shadow-md"
          >
            {content}
            <TooltipPrimitive.Arrow className="fill-border" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
