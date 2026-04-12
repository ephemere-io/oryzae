'use client';

interface PhotoContent {
  imageUrl: string;
  caption: string;
}

interface PhotoCardContentProps {
  content: PhotoContent;
}

export function PhotoCardContent({ content }: PhotoCardContentProps) {
  return (
    <div className="flex h-full flex-col" style={{ padding: '12px 12px 32px' }}>
      <img
        src={content.imageUrl}
        alt={content.caption || 'Board photo'}
        style={{
          width: '100%',
          aspectRatio: '1',
          objectFit: 'cover',
          display: 'block',
          backgroundColor: 'var(--toolbar-hover)',
        }}
      />
      {content.caption && (
        <p className="mt-2 text-center text-xs italic" style={{ color: 'var(--date-color)' }}>
          {content.caption}
        </p>
      )}
    </div>
  );
}
