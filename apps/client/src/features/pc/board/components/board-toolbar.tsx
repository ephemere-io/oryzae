'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import {
  BOARD_INSET,
  ELEVATED_PANEL_CLASS,
  ELEVATED_PANEL_STYLE,
  IDLE_HOVER_CLASS,
  TOOL_BUTTON_CLASS,
} from './board-surface';

/** ツールバーで選べる道具。'none' はどのダイアログも開いていない状態。 */
type BoardTool = 'none' | 'snippet' | 'photo' | 'entry';

interface BoardToolbarProps {
  activeTool: BoardTool;
  onCreateSnippet: () => void;
  onAddPhoto: () => void;
  onPlaceEntry: () => void;
  /** 選択中のカード。null なら作成系の道具を出す。 */
  selection: { cardType: 'entry' | 'snippet' | 'photo' } | null;
  onOpenSelected: () => void;
  onBringSelectedToFront: () => void;
  onDeleteSelected: () => void;
  /** entry カードだけ: カードの上で本文を編集する。 */
  onEditSelectedOnCard?: () => void;
}

interface ToolSpec {
  id: 'snippet' | 'entry' | 'photo';
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

function EntryIcon() {
  return (
    <svg {...ICON_PROPS} aria-hidden="true">
      <path d="M4 4h11l5 5v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
      <path d="M15 4v5h5" />
      <path d="M7 13h8M7 17h5" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg {...ICON_PROPS} aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function OpenIcon() {
  return (
    <svg {...ICON_PROPS} aria-hidden="true">
      <path d="M7 17 17 7" />
      <path d="M9 7h8v8" />
    </svg>
  );
}

function FrontIcon() {
  return (
    <svg {...ICON_PROPS} aria-hidden="true">
      <path d="M12 3 3 8l9 5 9-5-9-5Z" />
      <path d="m3 14 9 5 9-5" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg {...ICON_PROPS} aria-hidden="true">
      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
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
export function BoardToolbar({
  activeTool,
  onCreateSnippet,
  onAddPhoto,
  onPlaceEntry,
  selection,
  onOpenSelected,
  onBringSelectedToFront,
  onDeleteSelected,
  onEditSelectedOnCard,
}: BoardToolbarProps) {
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
      id: 'entry',
      label: t('entry'),
      shortcut: 'E',
      onSelect: onPlaceEntry,
      icon: <EntryIcon />,
    },
    {
      id: 'photo',
      // ショートカットは I（Image）。Inter の大文字 i は縦棒とほぼ同形なので、
      // 一時 P に変えたことがあるが、読めなかった原因は文字ではなく**キーとして
      // 描いていなかったこと**だった。下のツールチップで kbd の枠に入れたので、
      // 意味の合う I に戻している。
      label: t('photo'),
      shortcut: 'I',
      onSelect: onAddPhoto,
      icon: <PhotoIcon />,
    },
  ];

  // カードを選んでいる間は、作る道具ではなく「そのカードにできること」を出す。
  // Backspace しか経路が無かった削除が、選んだ瞬間に目に入るようになる。
  // 操作の名前は種別で変えない。同じ形の操作に別々の言葉を当てると、
  // 「これは違う何かなのでは」と読ませてしまう。唯一の例外が「日記を開く」で、
  // 行き先が盤面の外（日記の画面）だと分かるほうが親切なため残している。
  const cardActions = selection
    ? [
        {
          id: 'open' as const,
          label: selection.cardType === 'entry' ? t('open_entry') : t('open'),
          onSelect: onOpenSelected,
          icon: <OpenIcon />,
          danger: false,
        },
        ...(selection.cardType === 'entry' && onEditSelectedOnCard
          ? [
              {
                id: 'edit' as const,
                label: t('edit'),
                onSelect: onEditSelectedOnCard,
                icon: <EditIcon />,
                danger: false,
              },
            ]
          : []),
        {
          id: 'front' as const,
          label: t('bring_to_front'),
          onSelect: onBringSelectedToFront,
          icon: <FrontIcon />,
          danger: false,
        },
        {
          id: 'delete' as const,
          label: t('delete'),
          onSelect: onDeleteSelected,
          icon: <TrashIcon />,
          danger: true,
        },
      ]
    : [];

  return (
    <div
      {...verifyAttrs({
        unit: 'BoardToolbar',
        activeTool,
        mode: selection ? 'card' : 'create',
        selectedType: selection?.cardType ?? 'none',
        toolCount: selection ? cardActions.length : tools.length,
      })}
      role="toolbar"
      aria-label={selection ? t('aria_label_card') : t('aria_label')}
      className={ELEVATED_PANEL_CLASS}
      style={{
        ...ELEVATED_PANEL_STYLE,
        bottom: BOARD_INSET,
        left: 'calc(50% + var(--sidebar-width, 0px) / 2)',
        transform: 'translateX(-50%)',
      }}
      // 盤面側の deselect（外側クリックで選択解除）まで伝播させない。
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {selection
        ? cardActions.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={action.onSelect}
              data-verify-card-action={action.id}
              className={`flex h-9 items-center gap-1.5 rounded-lg px-3 text-[11px] font-medium transition-colors ${IDLE_HOVER_CLASS} active:scale-95`}
              style={{ color: action.danger ? 'var(--accent)' : 'var(--fg)' }}
            >
              {action.icon}
              {action.label}
            </button>
          ))
        : null}

      {selection
        ? null
        : tools.map((tool) => {
            const isActive = activeTool === tool.id;
            return (
              <div key={tool.id} className="group relative">
                <button
                  type="button"
                  onClick={tool.onSelect}
                  aria-label={`${tool.label} (${tool.shortcut})`}
                  aria-pressed={isActive}
                  data-verify-tool={tool.id}
                  // 非アクティブ時は背景をインラインで指定しない。インライン style は
                  // CSS の :hover に必ず勝つため、指定すると hover が効かなくなる。
                  className={`${TOOL_BUTTON_CLASS} ${
                    isActive ? '' : `${IDLE_HOVER_CLASS} active:scale-95`
                  }`}
                  style={
                    isActive
                      ? { backgroundColor: 'var(--accent)', color: '#fff' }
                      : { color: 'var(--fg)' }
                  }
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
                  {/* キーであることが形で分かるように枠で囲う。ラベルの隣に薄い文字を
                  置くだけだと、1文字のショートカットは語尾の記号と見分けがつかない。 */}
                  <kbd
                    className="rounded border px-1 font-sans text-[10px] leading-[1.4]"
                    style={{ borderColor: 'currentColor', opacity: 0.55 }}
                  >
                    {tool.shortcut}
                  </kbd>
                </span>
              </div>
            );
          })}
    </div>
  );
}
