'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';

/** ツールバーで選べる道具。'none' はどのダイアログも開いていない状態。 */
type BoardTool = 'none' | 'snippet' | 'photo';

interface BoardToolbarProps {
  activeTool: BoardTool;
  onCreateSnippet: () => void;
  onAddPhoto: () => void;
}

interface ToolSpec {
  id: 'snippet' | 'photo';
  label: string;
  shortcut: string;
  onSelect: () => void;
  icon: React.ReactNode;
}

// aria-hidden は各 <svg> に直接書く。読み上げの対象はボタンの aria-label 側で、
// アイコンは装飾。スプレッドに含めると a11y lint（noSvgWithoutTitle）が見抜けない。
const ICON_PROPS = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

function SnippetIcon() {
  return (
    <svg {...ICON_PROPS} aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function PhotoIcon() {
  return (
    <svg {...ICON_PROPS} aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

/**
 * ボードの道具箱（Figma / FigJam の UI3 に倣った下部中央フローティングツールバー）。
 *
 * 位置は fixed。盤面（1200×900）はスクロールするが、道具は画面に貼り付いたまま
 * でないと使えないため、`absolute` で盤面に乗せない。左は PC サイドバーが占めるので
 * ビューポート中央ではなく **本文領域の中央** に置く（--sidebar-width は
 * (protected)/layout.tsx が <main> に生やしている）。
 *
 * z は 1600。ドラッグ中のカード(1000)と空状態の表示(1500)より上、
 * ダイアログ/ライトボックス(2000)より下。
 */
export function BoardToolbar({ activeTool, onCreateSnippet, onAddPhoto }: BoardToolbarProps) {
  const t = useTranslations('board.toolbar');

  const tools: ToolSpec[] = [
    {
      id: 'snippet',
      label: t('snippet'),
      shortcut: 'S',
      onSelect: onCreateSnippet,
      icon: <SnippetIcon />,
    },
    {
      id: 'photo',
      label: t('photo'),
      shortcut: 'I',
      onSelect: onAddPhoto,
      icon: <PhotoIcon />,
    },
  ];

  return (
    <div
      {...verifyAttrs({ unit: 'BoardToolbar', activeTool, toolCount: tools.length })}
      role="toolbar"
      aria-label={t('aria_label')}
      className="fixed bottom-6 z-[1600] flex items-center gap-1 rounded-[13px] border p-1.5 shadow-[0_8px_24px_-6px_rgba(0,0,0,0.22),0_2px_6px_-2px_rgba(0,0,0,0.12)]"
      style={{
        left: 'calc(50% + var(--sidebar-width, 0px) / 2)',
        transform: 'translateX(-50%)',
        backgroundColor: 'var(--bg)',
        borderColor: 'var(--border-subtle)',
        fontFamily: 'Inter, "Noto Sans JP", sans-serif',
      }}
      // 盤面側の deselect（外側クリックで選択解除）まで伝播させない。
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {tools.map((tool) => {
        const isActive = activeTool === tool.id;
        return (
          <div key={tool.id} className="group relative">
            <button
              type="button"
              onClick={tool.onSelect}
              aria-label={`${tool.label} (${tool.shortcut})`}
              aria-pressed={isActive}
              data-verify-tool={tool.id}
              className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors"
              style={
                isActive
                  ? { backgroundColor: 'var(--accent)', color: '#fff' }
                  : { backgroundColor: 'transparent', color: 'var(--fg)' }
              }
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.backgroundColor = 'var(--toolbar-hover)';
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {tool.icon}
            </button>

            {/* ツールチップ（Figma と同じく、ラベル＋ショートカット）。常に DOM には
                置き、hover でだけ見せる（描画契約として検証できるようにするため）。
                aria-hidden なのは、同じ文言をボタンの aria-label が既に持っており、
                読み上げが二重になるため。ここは目で見るための装飾に徹する。 */}
            <span
              aria-hidden="true"
              data-verify-tooltip={tool.id}
              className="pointer-events-none absolute bottom-full left-1/2 mb-2 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-[11px] opacity-0 transition-opacity group-hover:opacity-100"
              style={{ backgroundColor: 'var(--fg)', color: 'var(--bg)' }}
            >
              {tool.label}
              <span style={{ opacity: 0.6 }}>{tool.shortcut}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
