'use client';

interface SnippetContent {
  text: string;
}

interface SnippetCardContentProps {
  content: SnippetContent;
}

export function SnippetCardContent({ content }: SnippetCardContentProps) {
  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-2 flex items-center gap-2">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: '#E5D5A0' }}
        />
        <span
          className="rounded-sm border px-1.5 py-0.5 text-[9px] uppercase tracking-wider"
          style={{
            borderColor: 'var(--accent)',
            color: 'var(--accent)',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          ✦ Snippet
        </span>
      </div>
      <p className="flex-1 text-sm leading-relaxed" style={{ color: 'var(--fg)' }}>
        {content.text}
      </p>
    </div>
  );
}
