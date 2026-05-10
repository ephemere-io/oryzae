import Link from 'next/link';
import { MarkdownView } from '@/components/ui/markdown-view';
import type { MdNode } from '@/lib/markdown';

interface MarkdownPageProps {
  nodes: MdNode[];
  homeLabel: string;
}

/**
 * Layout shell for static markdown-backed pages (privacy policy, support, etc.).
 * Public — does not assume the user is signed in.
 */
export function MarkdownPage({ nodes, homeLabel }: MarkdownPageProps) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <nav className="mb-10">
        <Link
          href="/"
          className="text-xs font-medium uppercase tracking-[0.18em] transition-colors"
          style={{ color: 'var(--date-color)', fontFamily: 'Inter, sans-serif' }}
        >
          ← {homeLabel}
        </Link>
      </nav>
      <article style={{ fontFamily: 'inherit' }}>
        <MarkdownView nodes={nodes} />
      </article>
    </div>
  );
}
