'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';

export type EditorStatus = 'editing' | 'saved' | 'saving' | 'autosaving';

interface EditorStatusBarProps {
  status: EditorStatus;
  /** 直近の保存が完了した時刻（epoch ms）。まだ一度も保存していなければ null。 */
  lastSavedAt?: number | null;
}

/**
 * 左下の小さな処理表示。
 *
 * 以前はここが画面幅いっぱいの帯で、保存状態・文字数・「あと何字で漬け込みの目安」を
 * 並べていた。**どれも書いている最中に読む必要が無い**ものだった:
 *
 *  - 文字数は、見せたところで書き手の判断が変わらない
 *  - 「あと何字」は条件の説明であって、条件そのものはボタンの活性/非活性が伝えればよく、
 *    理由はパレットのツールチップで足りる
 *
 * 残すのは「いま裏で何が起きているか」だけ。保存という**目に見えない処理**は、
 * 起きていることが分からないと不安になるので、そこだけ小さく灯す。
 * 何も起きていないときは何も出さない（無言が既定）。
 */
export function EditorStatusBar({ status, lastSavedAt = null }: EditorStatusBarProps) {
  const t = useTranslations('editor.status');

  const isInFlight = status === 'saving' || status === 'autosaving';
  const showSaved = status === 'saved' && lastSavedAt !== null;
  const label = isInFlight ? t('saving_now') : showSaved ? t('saved_moment_ago') : '';

  return (
    <div
      className="pointer-events-none fixed bottom-4 left-6 z-[40] flex items-center gap-1.5 text-[11px] text-[var(--date-color)] transition-opacity duration-500"
      style={{ opacity: label ? 1 : 0 }}
      aria-live="polite"
      {...verifyAttrs({
        unit: 'EditorStatusBar',
        status,
        inFlight: isInFlight,
        everSaved: lastSavedAt !== null,
        visible: Boolean(label),
      })}
    >
      <span
        aria-hidden="true"
        className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
          isInFlight ? 'animate-pulse bg-amber-500' : 'bg-emerald-500'
        }`}
      />
      <span>{label}</span>
    </div>
  );
}
