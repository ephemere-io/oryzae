'use client';

import { useTranslations } from 'next-intl';
import { FloatingPalette } from '@/components/ui/floating-palette';
import { HOVER_CLASS, ICON_STROKE_WIDTH, TOOL_BUTTON_CLASS } from '@/components/ui/surface';
import { BOARD_INSET } from './board-surface';

/** ツールバーで選べる道具。'none' はどのダイアログも開いていない状態。 */
type BoardTool = 'none' | 'snippet' | 'ocr' | 'photo';

interface BoardToolbarProps {
  activeTool: BoardTool;
  onCreateSnippet: () => void;
  /** 画像から文字を読み取ってスニペットにする。作成ダイアログを画像タブで開く。 */
  onReadImage: () => void;
  onAddPhoto: () => void;
  /** 選択中のカード。null なら作成系の道具を出す。 */
  selection: { cardType: 'snippet' | 'photo' } | null;
  onOpenSelected: () => void;
  onBringSelectedToFront: () => void;
  onDeleteSelected: () => void;
}

interface ToolSpec {
  id: 'snippet' | 'ocr' | 'photo';
  label: string;
  shortcut: string;
  onSelect: () => void;
  icon: (size: number) => React.ReactNode;
}

/** 位置と畳み具合を憶える鍵。エントリーの操作パレットとは別に持つ。 */
const STORAGE = {
  anchor: 'oryzae-board-toolbar-anchor',
  collapsed: 'oryzae-board-toolbar-collapsed',
} as const;

// アイコンの寸法は面の大きさの段に従う（エントリーの操作パレットと同じ）。
// aria-hidden は各 <svg> に直接書く。スプレッドに含めると a11y lint が見抜けない。
function iconProps(size: number) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: ICON_STROKE_WIDTH,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  } as const;
}

function SnippetIcon({ size }: { size: number }) {
  return (
    <svg {...iconProps(size)} aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function PhotoIcon({ size }: { size: number }) {
  return (
    <svg {...iconProps(size)} aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

/** 画像から文字を読み取る。枠の中に字がある形で「写真そのもの」と区別する。 */
function ScanTextIcon({ size }: { size: number }) {
  return (
    <svg {...iconProps(size)} aria-hidden="true">
      <path d="M3 8V5a2 2 0 0 1 2-2h3" />
      <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
      <path d="M3 16v3a2 2 0 0 0 2 2h3" />
      <path d="M21 16v3a2 2 0 0 1-2 2h-3" />
      <path d="M7 10h10M7 14h6" />
    </svg>
  );
}

function OpenIcon({ size }: { size: number }) {
  return (
    <svg {...iconProps(size)} aria-hidden="true">
      <path d="M7 17 17 7" />
      <path d="M9 7h8v8" />
    </svg>
  );
}

function FrontIcon({ size }: { size: number }) {
  return (
    <svg {...iconProps(size)} aria-hidden="true">
      <path d="M12 3 3 8l9 5 9-5-9-5Z" />
      <path d="m3 14 9 5 9-5" />
    </svg>
  );
}

function TrashIcon({ size }: { size: number }) {
  return (
    <svg {...iconProps(size)} aria-hidden="true">
      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
    </svg>
  );
}

/**
 * ボードの道具箱。**面そのものはエントリーの操作パレットと同じ `FloatingPalette`。**
 *
 * 以前はボード専用に作っていて、エントリーと比べて「掴み手が無い」「畳めない」
 * 「ボタンの大きさが違う」と少しずつずれていた。「同じコンポーネントを使っていて
 * ほしい」と報告されたので、動かす・畳む・見た目は共通の殻に任せ、ここは並べる道具
 * だけを持つ。定位置だけはボードの余白（`BOARD_INSET`）に合わせる。
 *
 * z は 1600（殻が持つ）。ドラッグ中のカード(1000)と空状態の表示(1500)より上、
 * ダイアログ/ライトボックス(2000)より下。
 */
export function BoardToolbar({
  activeTool,
  onCreateSnippet,
  onReadImage,
  onAddPhoto,
  selection,
  onOpenSelected,
  onBringSelectedToFront,
  onDeleteSelected,
}: BoardToolbarProps) {
  const t = useTranslations('board.toolbar');

  const tools: ToolSpec[] = [
    {
      id: 'snippet',
      label: t('snippet'),
      shortcut: 'S',
      onSelect: onCreateSnippet,
      icon: (size) => <SnippetIcon size={size} />,
    },
    {
      id: 'ocr',
      // スニペット作成の中のタブに埋もれていて、読み取りに着くまで2手かかっていた。
      // 「画像から作る」は独立した意図なので、道具として出す。
      label: t('ocr'),
      shortcut: 'R',
      onSelect: onReadImage,
      icon: (size) => <ScanTextIcon size={size} />,
    },
    {
      id: 'photo',
      // ショートカットは I（Image）。下のツールチップで kbd の枠に入れて、1 文字でも
      // キーだと読めるようにしてある。
      label: t('photo'),
      shortcut: 'I',
      onSelect: onAddPhoto,
      icon: (size) => <PhotoIcon size={size} />,
    },
  ];

  // カードを選んでいる間は、作る道具ではなく「そのカードにできること」を出す。
  // 操作の名前は種別で変えない。同じ形の操作に別々の言葉を当てると、
  // 「これは違う何かなのでは」と読ませてしまう。
  const cardActions = selection
    ? [
        {
          id: 'open' as const,
          label: t('open'),
          onSelect: onOpenSelected,
          icon: (size: number) => <OpenIcon size={size} />,
          danger: false,
        },
        {
          id: 'front' as const,
          label: t('bring_to_front'),
          onSelect: onBringSelectedToFront,
          icon: (size: number) => <FrontIcon size={size} />,
          danger: false,
        },
        {
          id: 'delete' as const,
          label: t('delete'),
          onSelect: onDeleteSelected,
          icon: (size: number) => <TrashIcon size={size} />,
          danger: true,
        },
      ]
    : [];

  return (
    <FloatingPalette
      contract={{
        unit: 'BoardToolbar',
        activeTool,
        mode: selection ? 'card' : 'create',
        selectedType: selection?.cardType ?? 'none',
        toolCount: selection ? cardActions.length : tools.length,
      }}
      storage={STORAGE}
      dockBottom={BOARD_INSET}
      collapseLabel={t('collapse')}
      expandLabel={t('expand')}
      role="toolbar"
      ariaLabel={selection ? t('aria_label_card') : t('aria_label')}
      // 盤面側の deselect（外側クリックで選択解除）まで伝播させない。
      isolateEvents
    >
      {({ scale, consumeMoved }) =>
        selection
          ? cardActions.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => {
                  if (consumeMoved()) return;
                  action.onSelect();
                }}
                data-verify-card-action={action.id}
                className={`flex shrink-0 items-center gap-1.5 px-3 text-[11px] font-medium ${HOVER_CLASS} active:scale-95`}
                style={{
                  height: scale.button,
                  borderRadius: scale.buttonRadius,
                  color: action.danger ? 'var(--accent)' : 'var(--fg)',
                }}
              >
                {action.icon(scale.icon)}
                {action.label}
              </button>
            ))
          : tools.map((tool) => {
              const isActive = activeTool === tool.id;
              return (
                <div key={tool.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => {
                      if (consumeMoved()) return;
                      tool.onSelect();
                    }}
                    aria-label={`${tool.label} (${tool.shortcut})`}
                    aria-pressed={isActive}
                    data-verify-tool={tool.id}
                    // 非アクティブ時は背景をインラインで指定しない。インライン style は
                    // CSS の :hover に必ず勝つため、指定すると hover が効かなくなる。
                    className={`${TOOL_BUTTON_CLASS} ${isActive ? '' : HOVER_CLASS}`}
                    style={{
                      height: scale.button,
                      width: scale.button,
                      borderRadius: scale.buttonRadius,
                      ...(isActive
                        ? { backgroundColor: 'var(--accent)', color: '#fff' }
                        : { color: 'var(--fg)' }),
                    }}
                  >
                    {tool.icon(scale.icon)}
                  </button>

                  {/* ツールチップ（ラベル＋ショートカット）。常に DOM には置き、hover でだけ
                      見せる（描画契約として検証できるようにするため）。aria-hidden なのは、
                      同じ文言をボタンの aria-label が既に持っており、読み上げが二重になるため。 */}
                  <span
                    aria-hidden="true"
                    data-verify-tooltip={tool.id}
                    className="pointer-events-none absolute bottom-full left-1/2 mb-2 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-[11px] opacity-0 transition-opacity group-hover:opacity-100"
                    style={{ backgroundColor: 'var(--fg)', color: 'var(--bg)' }}
                  >
                    {tool.label}
                    {/* キーであることが形で分かるように枠で囲う。 */}
                    <kbd
                      className="rounded border px-1 font-sans text-[10px] leading-[1.4]"
                      style={{ borderColor: 'currentColor', opacity: 0.55 }}
                    >
                      {tool.shortcut}
                    </kbd>
                  </span>
                </div>
              );
            })
      }
    </FloatingPalette>
  );
}
