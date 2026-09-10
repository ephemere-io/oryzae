'use client';

import { verifyAttrs } from '@oryzae/verify';

interface PhotoContent {
  imageUrl: string;
  caption: string;
}

interface PhotoCardContentProps {
  content: PhotoContent;
  /** 引ききった状態ではキャプション（文字）だけ隠す。画像そのものは常に描く。 */
  captionHidden?: boolean;
}

export function PhotoCardContent({ content, captionHidden = false }: PhotoCardContentProps) {
  return (
    <div
      className="flex h-full flex-col"
      style={{ padding: '12px 12px 32px' }}
      {...verifyAttrs({
        unit: 'PhotoCardContent',
        hasCaption: Boolean(content.caption),
      })}
    >
      <img
        src={content.imageUrl}
        alt={content.caption || 'Board photo'}
        // 画像はブラウザ既定でドラッグできる。掴んだ瞬間にネイティブの画像ドラッグが
        // 始まってしまい、カードを動かせなくなっていた（カード全面を覆っていた
        // 透明ボタンを外した副作用）。
        draggable={false}
        style={{
          width: '100%',
          flex: '1 1 auto',
          minHeight: 0,
          objectFit: 'contain',
          display: 'block',
          backgroundColor: 'var(--hover-wash)',
        }}
      />
      {content.caption && !captionHidden && (
        <p
          className="mt-2 shrink-0 text-center text-xs italic"
          style={{ color: 'var(--date-color)' }}
        >
          {content.caption}
        </p>
      )}
    </div>
  );
}
