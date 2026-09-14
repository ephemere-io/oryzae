'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import type { UnsubscribeState } from '../types';

interface Props {
  state: UnsubscribeState;
  onResubscribe: () => void;
}

/**
 * 配信停止ページの中身（メールのリンクから来る）。
 *
 * 状態を出すだけの表示部品。実際の切り替えは `useNewsletterUnsubscribe` が
 * ページを開いた時点で済ませている（「クリックするだけで登録解除」）。
 *
 * ログインしていない人が見るページなので、**アカウントには何も起きていない**
 * ことを明示する。「解除」の語だけだと退会したように読める。
 */
export function UnsubscribePanel({ state, onResubscribe }: Props) {
  const t = useTranslations('newsletter.unsubscribe');

  return (
    <div
      {...verifyAttrs({ unit: 'UnsubscribePanel', state: state.status })}
      className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12"
    >
      <p
        className="mb-6 text-xs font-semibold uppercase tracking-[0.2em]"
        style={{ color: 'var(--accent)', fontFamily: 'Inter, sans-serif' }}
      >
        Oryzae
      </p>

      {state.status === 'working' && (
        <p className="text-sm" style={{ color: 'var(--date-color)' }}>
          {t('working')}
        </p>
      )}

      {state.status === 'unsubscribed' && (
        <>
          <h1 className="mb-3 text-lg font-medium" style={{ color: 'var(--fg)' }}>
            {t('done_title')}
          </h1>
          <p className="mb-2 text-sm leading-relaxed" style={{ color: 'var(--fg)' }}>
            {t('done_body')}
          </p>
          {/* 退会したと誤解されないよう、残るものを明示する。 */}
          <p className="mb-6 text-xs leading-relaxed" style={{ color: 'var(--date-color)' }}>
            {t('account_kept')}
          </p>
          <button
            type="button"
            onClick={onResubscribe}
            className="self-start text-sm underline-offset-2 transition-colors hover:underline"
            style={{ color: 'var(--accent)' }}
          >
            {t('undo')}
          </button>
        </>
      )}

      {state.status === 'resubscribed' && (
        <>
          <h1 className="mb-3 text-lg font-medium" style={{ color: 'var(--fg)' }}>
            {t('resumed_title')}
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--fg)' }}>
            {t('resumed_body')}
          </p>
        </>
      )}

      {state.status === 'error' && (
        <>
          <h1 className="mb-3 text-lg font-medium" style={{ color: 'var(--fg)' }}>
            {t('error_title')}
          </h1>
          <p className="mb-6 text-sm leading-relaxed" style={{ color: 'var(--fg)' }}>
            {state.message}
          </p>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--date-color)' }}>
            {t('error_fallback')}
          </p>
        </>
      )}
    </div>
  );
}
