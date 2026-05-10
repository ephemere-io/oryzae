import type { InlineNode, MdNode } from '@/lib/markdown';

const headingClass: Record<1 | 2 | 3, string> = {
  1: 'mb-8 text-2xl font-semibold tracking-tight',
  2: 'mb-3 mt-10 text-lg font-semibold tracking-tight',
  3: 'mb-2 mt-6 text-sm font-semibold uppercase tracking-[0.12em]',
};

function renderInlineNode(node: InlineNode): React.ReactElement {
  switch (node.kind) {
    case 'text':
      return <span key={node.id}>{node.value}</span>;
    case 'bold':
      return (
        <strong key={node.id} className="font-semibold">
          {renderInline(node.children)}
        </strong>
      );
    case 'code':
      return (
        <code
          key={node.id}
          className="rounded px-1 py-0.5 font-mono text-[0.85em]"
          style={{ backgroundColor: 'var(--border-subtle)', color: 'var(--fg)' }}
        >
          {node.value}
        </code>
      );
    case 'link':
      return (
        <a
          key={node.id}
          href={node.href}
          className="underline transition-colors"
          style={{ color: 'var(--accent)' }}
          target={node.href.startsWith('http') ? '_blank' : undefined}
          rel={node.href.startsWith('http') ? 'noopener noreferrer' : undefined}
        >
          {renderInline(node.children)}
        </a>
      );
  }
}

function renderInline(nodes: InlineNode[]): React.ReactElement[] {
  return nodes.map(renderInlineNode);
}

function renderBlock(node: MdNode): React.ReactElement {
  switch (node.kind) {
    case 'heading': {
      if (node.level === 1) {
        return (
          <h1 key={node.id} className={headingClass[1]} style={{ color: 'var(--fg)' }}>
            {renderInline(node.text)}
          </h1>
        );
      }
      if (node.level === 2) {
        return (
          <h2 key={node.id} className={headingClass[2]} style={{ color: 'var(--fg)' }}>
            {renderInline(node.text)}
          </h2>
        );
      }
      return (
        <h3 key={node.id} className={headingClass[3]} style={{ color: 'var(--accent)' }}>
          {renderInline(node.text)}
        </h3>
      );
    }
    case 'paragraph':
      return (
        <p
          key={node.id}
          className="my-4 text-sm leading-7"
          style={{ color: 'var(--fg)', fontFamily: 'inherit' }}
        >
          {renderInline(node.text)}
        </p>
      );
    case 'list': {
      const items = node.items.map((item) => (
        <li key={item.id} className="my-1 leading-7">
          {renderInline(item.text)}
        </li>
      ));
      const className = 'my-4 ml-6 text-sm';
      const style = { color: 'var(--fg)' };
      return node.ordered ? (
        <ol key={node.id} className={`${className} list-decimal`} style={style}>
          {items}
        </ol>
      ) : (
        <ul key={node.id} className={`${className} list-disc`} style={style}>
          {items}
        </ul>
      );
    }
    case 'table':
      return (
        <div key={node.id} className="my-6 overflow-x-auto">
          <table
            className="w-full border-collapse text-left text-xs"
            style={{ color: 'var(--fg)' }}
          >
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                {node.head.map((cell) => (
                  <th
                    key={cell.id}
                    className="px-3 py-2 font-semibold uppercase tracking-[0.08em]"
                    style={{ color: 'var(--date-color)' }}
                  >
                    {renderInline(cell.text)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {node.rows.map((row) => (
                <tr key={row.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  {row.cells.map((cell) => (
                    <td key={cell.id} className="px-3 py-2 align-top leading-6">
                      {renderInline(cell.text)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

export function MarkdownView({ nodes }: { nodes: MdNode[] }) {
  return <div>{nodes.map(renderBlock)}</div>;
}
