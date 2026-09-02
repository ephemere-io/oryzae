'use client';

import { verifyAttrs } from '@oryzae/verify';

interface SnippetContent {
  text: string;
}

interface SnippetCardContentProps {
  content: SnippetContent;
}

export function SnippetCardContent({ content }: SnippetCardContentProps) {
  return (
    <div
      className="flex h-full flex-col p-6"
      {...verifyAttrs({
        unit: 'SnippetCardContent',
        textLen: content.text.length,
        empty: content.text.length === 0,
      })}
    >
      {/* エントリと同じ体裁の小さな見出しだけにする。
          以前は光る点＋枠付きバッジ（✦ Snippet）を出していたが、他の種類には
          無いのでスニペットだけ賑やかになっていた。カードの地色（黄）で種類は
          十分に分かる。 */}
      <div className="mb-2 flex shrink-0 items-center pb-2">
        <span
          className="text-[9px] uppercase tracking-[0.2em]"
          style={{ color: 'var(--date-color)', fontFamily: 'Inter, sans-serif' }}
        >
          Snippet
        </span>
      </div>
      {/* カードの高さは作成時の本文量から見積もっている。あとから編集して伸びた分は
          ここで送れるようにする（カード自体は overflow:hidden なので、これが無いと
          はみ出した文字が黙って消える）。

          引いたときに行数を間引く（line-clamp）ことはしない。スクロールする本文と
          両立しないうえ、読めない倍率では下の CardTextGlyph に丸ごと入れ替わるので、
          中間倍率だけのために描画を削っても得るものが無い。 */}
      <p
        className="board-scroll min-h-0 flex-1 overflow-auto whitespace-pre-wrap text-sm"
        style={{ color: 'var(--fg)', lineHeight: 1.8 }}
      >
        {content.text}
      </p>
    </div>
  );
}
