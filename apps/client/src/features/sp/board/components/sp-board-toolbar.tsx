'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import {
  CONTROL_FONT,
  ELEVATED_PANEL_CLASS,
  ELEVATED_PANEL_STYLE,
  HOVER_CLASS,
  ICON_STROKE_WIDTH,
} from '@/components/ui/surface';

/**
 * SP のボードの道具箱（盤面の下に**流れの中で**置く）。
 *
 * PC（#524）と同じ考え方で、**選んでいるものに応じて中身が入れ替わる**:
 *  - 何も選んでいない … 作るもの（スニペット / 画像から読み取る / 写真）
 *  - カードを選んでいる … そのカードにできること（編集 / 開く / 前面へ / 外す）
 *
 * 面は PC のパレットと同じ `ELEVATED_PANEL_*`、字は `CONTROL_FONT`。以前は文字だけの
 * ピルで、明朝の画面の中に道具の字だけが別の書体で浮いて見えた。PC と同じアイコンに
 * 短い名前を添える（SP にはホバーが無いので名前を隠せない）。
 *
 * PC のツールバーを共有しないのは reach 分離（pc ⇔ sp の import 禁止）と、
 * 指と矢印で当たりの大きさも並べ方も違うため。共有するのは語彙と面の素材だけにする。
 */

/** 道具箱の 2 つの顔。契約（data-verify-mode）に出す値でもある。 */
type ToolbarMode = 'create' | 'card';

export interface SpBoardToolbarProps {
  /** 選んでいるカードの種類。`null` なら何も選んでいない。 */
  selectedType: 'snippet' | 'photo' | null;
  /** カードを選んでいる間、編集できるか（スニペットだけ）。 */
  onEdit?: () => void;
  /** 写真を大きく見る（写真だけ）。 */
  onOpen?: () => void;
  onBringToFront?: () => void;
  onDelete?: () => void;
  onCreateSnippet?: () => void;
  /** 画像から文字を読み取ってスニペットにする。 */
  onReadImage?: () => void;
  onCreatePhoto?: () => void;
  /** 何かを作っている最中（連打で二重に作らせない）。 */
  busy?: boolean;
}

export function SpBoardToolbar({
  selectedType,
  onEdit,
  onOpen,
  onBringToFront,
  onDelete,
  onCreateSnippet,
  onReadImage,
  onCreatePhoto,
  busy = false,
}: SpBoardToolbarProps) {
  const t = useTranslations('sp.board');
  const mode: ToolbarMode = selectedType === null ? 'create' : 'card';

  return (
    <div
      {...verifyAttrs({ unit: 'SpBoardToolbar', mode, selectedType: selectedType ?? 'none', busy })}
      role="toolbar"
      // 置き場は `SpBoard` の下端の列で、ここは形だけを持つ。`w-max` で語の幅のまま置く
      // （縮めると「前面／へ」で折り返す）。
      className={`w-max gap-1 rounded-2xl p-1.5 ${ELEVATED_PANEL_CLASS}`}
      style={{ ...ELEVATED_PANEL_STYLE, ...CONTROL_FONT }}
    >
      {mode === 'create' ? (
        <>
          <Tool
            name={t('add_snippet')}
            label={t('tool_snippet')}
            icon={<SnippetIcon />}
            onClick={onCreateSnippet}
            disabled={busy}
          />
          <Tool
            name={t('read_image')}
            label={t('tool_read_image')}
            icon={<ScanTextIcon />}
            onClick={onReadImage}
            disabled={busy}
          />
          <Tool
            name={t('add_photo')}
            label={t('tool_photo')}
            icon={<PhotoIcon />}
            onClick={onCreatePhoto}
            disabled={busy}
          />
        </>
      ) : (
        <>
          {/* 写真は本文を持たないので編集を出さない（押せるのに何も起きない、を作らない）。 */}
          {selectedType === 'snippet' && (
            <Tool name={t('edit')} label={t('edit')} icon={<SnippetIcon />} onClick={onEdit} />
          )}
          {/* 開くは写真だけ。スニペットの全文は「編集」で読める。 */}
          {selectedType === 'photo' && (
            <Tool name={t('open')} label={t('open')} icon={<OpenIcon />} onClick={onOpen} />
          )}
          <Tool
            name={t('bring_to_front')}
            label={t('bring_to_front')}
            icon={<FrontIcon />}
            onClick={onBringToFront}
          />
          <Tool
            name={t('remove')}
            label={t('remove')}
            icon={<TrashIcon />}
            onClick={onDelete}
            tone="danger"
          />
        </>
      )}
    </div>
  );
}

function Tool({
  name,
  label,
  icon,
  onClick,
  disabled = false,
  tone = 'normal',
}: {
  /** 読み上げに出す正式な名前（`aria-label`）。 */
  name: string;
  /** 目に見える短い名前。 */
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: 'normal' | 'danger';
}) {
  return (
    <button
      type="button"
      aria-label={name}
      onClick={onClick}
      disabled={disabled || onClick === undefined}
      className={`flex min-w-[64px] flex-col items-center justify-center gap-1 whitespace-nowrap rounded-xl px-2 pt-2 pb-1.5 transition-colors active:scale-95 disabled:opacity-40 ${HOVER_CLASS}`}
      style={{ color: tone === 'danger' ? 'var(--ob-jar-warm)' : 'var(--fg)' }}
    >
      {icon}
      <span className="text-[10px] leading-none tracking-[0.04em]">{label}</span>
    </button>
  );
}

/** アイコンの寸法と線幅は PC のパレットと同じ（線幅 1.6）。 */
function iconProps() {
  return {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: ICON_STROKE_WIDTH,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  } as const;
}

function SnippetIcon() {
  return (
    <svg {...iconProps()} aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function ScanTextIcon() {
  return (
    <svg {...iconProps()} aria-hidden="true">
      <path d="M3 8V5a2 2 0 0 1 2-2h3" />
      <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
      <path d="M3 16v3a2 2 0 0 0 2 2h3" />
      <path d="M21 16v3a2 2 0 0 1-2 2h-3" />
      <path d="M7 10h10M7 14h6" />
    </svg>
  );
}

function PhotoIcon() {
  return (
    <svg {...iconProps()} aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

function OpenIcon() {
  return (
    <svg {...iconProps()} aria-hidden="true">
      <path d="M7 17 17 7" />
      <path d="M9 7h8v8" />
    </svg>
  );
}

function FrontIcon() {
  return (
    <svg {...iconProps()} aria-hidden="true">
      <path d="M12 3 3 8l9 5 9-5-9-5Z" />
      <path d="m3 14 9 5 9-5" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg {...iconProps()} aria-hidden="true">
      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
    </svg>
  );
}
