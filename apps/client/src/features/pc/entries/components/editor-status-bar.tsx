'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

export type EditorStatus = 'editing' | 'saved' | 'saving' | 'autosaving';

/** 漬け込みの「目安」文字数。実際の発酵トリガーはサーバー側（#338 で設計中）。 */
export const PICKLE_HINT_CHARS = 2000;

const RELATIVE_TICK_MS = 15_000;

interface EditorStatusBarProps {
  status: EditorStatus;
  charCount: number;
  /** 直近の保存が完了した時刻（epoch ms）。まだ一度も保存していなければ null。 */
  lastSavedAt?: number | null;
  /** 文字数をクリックしたとき（執筆統計を開く）。 */
  onCharCountClick?: () => void;
}

/**
 * エディタ下部のステータスバー。
 *
 * Issue #360「このbarがなんのための何か直感的に理解できない」への回答。
 * この帯は**保存が起きていることを語り続ける唯一の場所**であり、それによって
 * 「保存ボタンが無い ＝ 自動保存されている」（docs/entry-screen-design.md 原則2）が成立する。
 * Issue #356 の「保存については即時保存なのか、保存ボタンを押す必要があるのか分からない」も
 * ここで解消する。
 *
 * 3カラム構成（Issue #229 — ステータスバーを文脈情報の場として使う）:
 *   左   … 保存状態（「たった今保存しました」/「保存中…」/「入力すると自動保存されます」）
 *   中央 … 文字数ゲージ ＋ 文字数（クリックで執筆統計）
 *   右   … 漬け込みまでの文脈
 */
export function EditorStatusBar({
  status,
  charCount,
  lastSavedAt = null,
  onCharCountClick,
}: EditorStatusBarProps) {
  const t = useTranslations('editor.status');

  const isInFlight = status === 'saving' || status === 'autosaving';
  const fillPct = Math.min(100, (charCount / PICKLE_HINT_CHARS) * 100);

  // 「N分前に保存しました」を時間経過に追随させる。保存が一度も起きていない間は
  // タイマーを持たない（新規エントリを開いただけで毎分再描画しないため）。
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (lastSavedAt === null) {
      setNow(null);
      return;
    }
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), RELATIVE_TICK_MS);
    return () => clearInterval(timer);
  }, [lastSavedAt]);

  const saveText = describeSave({ isInFlight, status, lastSavedAt, now, t });
  const contextText = describeContext(charCount, t);

  return (
    <div
      className="grid grid-cols-3 items-center border-t border-[var(--border-subtle)] px-4 py-1.5 text-xs text-[var(--date-color)]"
      {...verifyAttrs({
        unit: 'EditorStatusBar',
        status,
        charCount,
        inFlight: isInFlight,
        fillPct,
        everSaved: lastSavedAt !== null,
      })}
    >
      <div className="flex items-center gap-2">
        <span
          className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
            status === 'saved' ? 'bg-emerald-500' : isInFlight ? 'bg-amber-500' : 'bg-zinc-400'
          }`}
        />
        <span className="truncate">{saveText}</span>
      </div>

      <div className="flex items-center justify-center gap-2">
        <div className="h-1 w-24 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
          <div
            className="h-full rounded-full bg-zinc-400 transition-all duration-300"
            style={{ width: `${fillPct}%` }}
          />
        </div>
        <button
          type="button"
          onClick={onCharCountClick}
          disabled={!onCharCountClick}
          aria-label={t('stats_open')}
          className="rounded px-1 tabular-nums transition-colors hover:text-[var(--fg)] disabled:cursor-default disabled:hover:text-[var(--date-color)]"
        >
          {charCount} CHARS
        </button>
      </div>

      <span className="justify-self-end truncate text-right">{contextText}</span>
    </div>
  );
}

function describeSave({
  isInFlight,
  status,
  lastSavedAt,
  now,
  t,
}: {
  isInFlight: boolean;
  status: EditorStatus;
  lastSavedAt: number | null;
  now: number | null;
  t: (key: string, values?: Record<string, number>) => string;
}): string {
  if (isInFlight) return t(status);
  if (lastSavedAt === null || now === null) return t('autosave_hint');

  const elapsedMinutes = Math.floor(Math.max(0, now - lastSavedAt) / 60_000);
  if (elapsedMinutes < 1) return t('saved_just_now');
  if (elapsedMinutes < 60) return t('saved_minutes_ago', { n: elapsedMinutes });
  return t('saved_hours_ago', { n: Math.floor(elapsedMinutes / 60) });
}

function describeContext(
  charCount: number,
  t: (key: string, values?: Record<string, number>) => string,
): string {
  if (charCount === 0) return t('context_empty');
  if (charCount < PICKLE_HINT_CHARS) {
    return t('context_progress', { n: PICKLE_HINT_CHARS - charCount });
  }
  return t('context_ready');
}
