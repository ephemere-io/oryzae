import Link from 'next/link';
import { MarkdownView } from '@/features/legal/components/markdown-view';
import type { MdNode } from '@/features/legal/lib/markdown';

interface LegalPageProps {
  nodes: MdNode[];
  homeLabel: string;
}

/**
 * Layout shell for static legal pages (privacy policy, etc.).
 * Public — does not assume the user is signed in.
 */
export function LegalPage({ nodes, homeLabel }: LegalPageProps) {
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
