'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';

/**
 * SP のボードの道具箱（盤面の下に**流れの中で**置く）。
 *
 * PC（#524）と同じ考え方で、**選んでいるものに応じて中身が入れ替わる**:
 *  - 何も選んでいない … 作るもの（抜粋 / 写真）
 *  - カードを選んでいる … そのカードにできること（編集 / 前面へ / 外す）
 *
 * 常に全部を並べないのは、縦画面に置ける横幅が限られるため。それ以上に、
 * 「いま何ができるか」を道具の側が示すほうが、押せるものを探させるより速い。
 *
 * PC のツールバーを共有しないのは reach 分離（pc ⇔ sp の import 禁止）と、
 * 指と矢印で当たりの大きさも並べ方も違うため。共有するのは語彙だけにする。
 */

/** 道具箱の 2 つの顔。契約（data-verify-mode）に出す値でもある。 */
type ToolbarMode = 'create' | 'card';

export interface SpBoardToolbarProps {
  /** 選んでいるカードの種類。`null` なら何も選んでいない。 */
  selectedType: 'snippet' | 'photo' | null;
  /** カードを選んでいる間、編集できるか（抜粋だけ）。 */
  onEdit?: () => void;
  onBringToFront?: () => void;
  onDelete?: () => void;
  onCreateSnippet?: () => void;
  onCreatePhoto?: () => void;
  /** 何かを作っている最中（連打で二重に作らせない）。 */
  busy?: boolean;
}

export function SpBoardToolbar({
  selectedType,
  onEdit,
  onBringToFront,
  onDelete,
  onCreateSnippet,
  onCreatePhoto,
  busy = false,
}: SpBoardToolbarProps) {
  const t = useTranslations('sp.board');
  const mode: ToolbarMode = selectedType === null ? 'create' : 'card';

  return (
    <div
      {...verifyAttrs({ unit: 'SpBoardToolbar', mode, selectedType: selectedType ?? 'none', busy })}
      // 盤面の上に浮かせていたが、「画面の一番下に固定で浮かせるのではなく、通常フロー内に
      // スペースを設けて」と報告された。浮かせると盤面の下端のカードに被り、指で掴めない。
      // 置き場は `SpBoard` の下端の列で、ここは形だけを持つ。`w-max` で語の幅のまま置く
      // （縮めると「前面／へ」で折り返す）。
      className="flex w-max items-center gap-1 rounded-full p-1"
      style={{
        background: 'rgba(253, 251, 247, 0.94)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: '1px solid var(--border-subtle)',
        boxShadow: '0 4px 20px rgba(140, 133, 126, 0.2)',
      }}
    >
      {mode === 'create' ? (
        <>
          <ToolButton label={t('add_snippet')} onClick={onCreateSnippet} disabled={busy} />
          <ToolButton label={t('add_photo')} onClick={onCreatePhoto} disabled={busy} />
        </>
      ) : (
        <>
          {/* 写真は本文を持たないので編集を出さない（押せるのに何も起きない、を作らない）。 */}
          {selectedType === 'snippet' && <ToolButton label={t('edit')} onClick={onEdit} />}
          <ToolButton label={t('bring_to_front')} onClick={onBringToFront} />
          <ToolButton label={t('remove')} onClick={onDelete} tone="danger" />
        </>
      )}
    </div>
  );
}

function ToolButton({
  label,
  onClick,
  disabled = false,
  tone = 'normal',
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  tone?: 'normal' | 'danger';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || onClick === undefined}
      className="whitespace-nowrap rounded-full px-4 py-2.5 text-[13px] transition-opacity disabled:opacity-40"
      style={{
        color: tone === 'danger' ? 'var(--ob-jar-warm)' : 'var(--fg)',
        fontFamily: 'var(--ob-font-sans)',
      }}
    >
      {label}
    </button>
  );
}
