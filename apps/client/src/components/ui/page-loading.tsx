'use client';

import { useTranslations } from 'next-intl';

/**
 * 画面いっぱいに1つだけ出すロード表示。
 *
 * スケルトンは「これから出るレイアウトを先に置く」もの。**レイアウトを予告できない画面**
 * （瓶やボードのようなキャンバス、位置がサーバー保存のカード等）で無理に枠を並べると、
 * 予告になっていない模様を見せたうえで読み込み完了時に全部差し替わる ＝ スケルトンの
 * 目的の逆になる。そういう画面はこれを出す。
 *
 * ルート遷移中も画面内のデータ取得中も同じものを出すことで、「枠 → ローダー → 本体」と
 * 表示が二度三度変わるのを防ぐ。
 *
 * 文言は i18n で解決する。"All Entries" / "CARDS" のような装飾ラベルは英語のままだが、
 * これは**状態を伝えるメッセージ**なので利用者の言語で出す（device-view の
 * 「スマホ未対応」表示と同じ扱い）。
 *
 * 位置指定済みの祖先（`relative` / `absolute`）の中で使うこと。
 */
export function PageLoading() {
  const t = useTranslations('app');

  return (
    <div
      data-testid="page-loading"
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute inset-0 z-[1500] flex items-center justify-center"
    >
      <span
        className="text-[10px] uppercase tracking-[0.2em]"
        style={{ color: 'var(--date-color)', fontFamily: 'Inter, sans-serif' }}
      >
        {t('loading')}
      </span>
    </div>
  );
}
