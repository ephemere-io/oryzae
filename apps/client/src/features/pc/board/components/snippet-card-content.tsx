'use client';

import { verifyAttrs } from '@oryzae/verify';

interface SnippetContent {
  text: string;
}

interface SnippetCardContentProps {
  content: SnippetContent;
  /**
   * 中倍率での簡略表示。**本文は隠さない**（スニペットは本文が唯一の中身で、
   * 消すと「✦ Snippet」ラベルだけの空カードになり壊れて見える）。
   * 行数だけ抑えて描画量を減らす。
   */
  titleOnly?: boolean;
}

export function SnippetCardContent({ content, titleOnly = false }: SnippetCardContentProps) {
  return (
    <div
      className="flex h-full flex-col p-6"
      {...verifyAttrs({
        unit: 'SnippetCardContent',
        titleOnly,
        textLen: content.text.length,
        empty: content.text.length === 0,
      })}
    >
      <div className="mb-2 flex items-center gap-2">
        <span
          className="inline-block h-1 w-1 rounded-full"
          style={{ backgroundColor: '#E5D5A0' }}
        />
        <span
          className="rounded px-1.5 py-0.5 text-[9px] uppercase tracking-[0.2em]"
          style={{
            border: '1px solid rgba(74,158,142,0.3)',
            backgroundColor: 'rgba(255,255,255,0.5)',
            color: 'var(--accent)',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          ✦ Snippet
        </span>
      </div>
      <p
        className={`flex-1 text-sm ${titleOnly ? 'line-clamp-2' : ''}`}
        style={{ color: 'var(--fg)', lineHeight: 1.8 }}
      >
        {content.text}
      </p>
    </div>
  );
}
