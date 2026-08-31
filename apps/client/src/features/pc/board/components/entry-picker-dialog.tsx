'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { PlaceableEntry } from '@/features/shared/board/types';
import { useEscapeKey } from '@/lib/use-escape-key';

interface EntryPickerDialogProps {
  open: boolean;
  entries: PlaceableEntry[];
  loading: boolean;
  error: boolean;
  onPlace: (entryId: string) => Promise<void>;
  onClose: () => void;
}

/**
 * その日（その週）に書いた日記から、盤面に置くものを選ぶ。
 *
 * 以前はサーバが期間内の日記を勝手にカード化していた。置いた覚えのないものが
 * 現れる一方で外し方も見えず、盤面が「自分で組み立てる場所」になっていなかった。
 * ここで選んで置き、外すのはカードを選んで削除する。
 *
 * 置き済みの日記も一覧からは消さない。消すと「さっき置いたものが無い」と読めて
 * しまうので、置いてあることを状態として見せて、押せなくする。
 */
export function EntryPickerDialog({
  open,
  entries,
  loading,
  error,
  onPlace,
  onClose,
}: EntryPickerDialogProps) {
  const t = useTranslations('board.entry_picker');
  const [placingId, setPlacingId] = useState<string | null>(null);
  /** 置く操作そのものが失敗した（一覧の取得失敗＝error とは別物）。 */
  const [failed, setFailed] = useState(false);

  useEscapeKey(open, onClose);

  if (!open) return null;

  const handlePlace = async (entryId: string) => {
    if (placingId) return;
    setPlacingId(entryId);
    try {
      await onPlace(entryId);
      // 置けたら閉じる。開いたままだと、置いたカードがこのダイアログの裏に出るうえ
      // 一覧の「置いてある」表示も変わらないので、押しても何も起きていないように
      // 見えていた（実際にはカードは作られている）。
      onClose();
    } catch {
      // 失敗したら開いたままにして、押し直せるようにする。
      setFailed(true);
    } finally {
      setPlacingId(null);
    }
  };

  return (
    <div
      {...verifyAttrs({
        unit: 'EntryPickerDialog',
        loading,
        error,
        failed,
        count: entries.length,
        placeable: entries.filter((e) => !e.placed).length,
      })}
      role="dialog"
      aria-label={t('aria_label')}
      className="fixed inset-0 z-[2000] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        className="flex w-[90%] max-w-[520px] flex-col rounded-xl shadow-lg"
        style={{ backgroundColor: 'var(--bg)', padding: '28px 32px', maxHeight: '70vh' }}
      >
        <h3 className="mb-1 text-sm font-semibold" style={{ color: 'var(--fg)' }}>
          {t('heading')}
        </h3>
        <p className="mb-4 text-xs" style={{ color: 'var(--date-color)' }}>
          {t('lead')}
        </p>

        {failed && (
          <p className="mb-3 text-xs" style={{ color: 'var(--accent)' }}>
            {t('place_failed')}
          </p>
        )}

        <div className="min-h-0 flex-1 overflow-auto">
          {loading && (
            <p className="py-8 text-center text-xs" style={{ color: 'var(--date-color)' }}>
              {t('loading')}
            </p>
          )}

          {!loading && error && (
            <p className="py-8 text-center text-xs" style={{ color: 'var(--accent)' }}>
              {t('load_failed')}
            </p>
          )}

          {!loading && !error && entries.length === 0 && (
            <p
              className="py-8 text-center text-xs leading-relaxed"
              style={{ color: 'var(--date-color)' }}
            >
              {t('empty')}
            </p>
          )}

          {!loading && !error && entries.length > 0 && (
            <ul className="flex flex-col gap-2">
              {entries.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    data-verify-entry-option={entry.id}
                    data-verify-entry-placed={String(entry.placed)}
                    disabled={entry.placed || placingId !== null}
                    onClick={() => handlePlace(entry.id)}
                    className="w-full rounded-lg border px-3 py-2.5 text-left transition-colors hover:bg-[var(--toolbar-hover)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    <span className="flex items-baseline justify-between gap-3">
                      <span
                        className="min-w-0 flex-1 truncate text-sm"
                        style={{ color: 'var(--fg)' }}
                      >
                        {entry.title || t('untitled')}
                      </span>
                      <span
                        className="shrink-0 text-[10px] uppercase tracking-[0.1em]"
                        style={{ color: 'var(--date-color)' }}
                      >
                        {entry.placed ? t('already_placed') : t('place')}
                      </span>
                    </span>
                    <span
                      className="mt-1 block truncate text-xs"
                      style={{ color: 'var(--date-color)' }}
                    >
                      {entry.preview}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border px-4 py-2 text-xs transition-colors hover:bg-[var(--toolbar-hover)]"
            style={{
              borderColor: 'var(--border-subtle)',
              color: 'var(--fg)',
              backgroundColor: 'var(--bg)',
            }}
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
}
