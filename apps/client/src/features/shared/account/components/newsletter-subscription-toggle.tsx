'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';

export interface NewsletterSubscriptionToggleProps {
  /** 購読中か。まだ読めていない / 読めなかったときは null。 */
  subscribed: boolean | null;
  saving: boolean;
  failed: boolean;
  onChange: (subscribed: boolean) => void;
}

/**
 * お知らせメールの受信可否を切り替える 1 行 (Issue #614)。表示だけを持つ。
 *
 * ## 表示は「受け取る」側
 *
 * 保存しているのは opt-**out** だが、画面では「受け取る」を ON にする。
 * 二重否定のチェックボックス（「受け取らないにチェック」）は必ず読み間違える。
 *
 * ## 読めていない間はトグルを出さない
 *
 * 既定値を仮置きすると、実際は停止中なのに「受け取る」に見える。その状態で
 * 触らせると、本人の意図と違う値がそのまま保存される。
 */
export function NewsletterSubscriptionToggle({
  subscribed,
  saving,
  failed,
  onChange,
}: NewsletterSubscriptionToggleProps) {
  const t = useTranslations('account.newsletter');

  return (
    <div
      {...verifyAttrs({
        unit: 'NewsletterSubscriptionToggle',
        state: subscribed === null ? 'unavailable' : 'ready',
        subscribed: subscribed ?? false,
        saving,
        failed,
      })}
      className="flex items-start justify-between gap-4"
    >
      <div>
        <p
          className="mb-1 text-xs font-medium uppercase tracking-[0.1em]"
          style={{ color: 'var(--date-color)', fontFamily: 'Inter, sans-serif' }}
        >
          {t('label')}
        </p>
        <p className="text-sm" style={{ color: 'var(--fg)' }}>
          {t('description')}
        </p>
        {failed && <p className="mt-1 text-xs text-red-500">{t('error')}</p>}
      </div>

      {subscribed !== null && (
        <label className="flex shrink-0 items-center gap-2 text-xs" style={{ color: 'var(--fg)' }}>
          <input
            type="checkbox"
            checked={subscribed}
            disabled={saving}
            onChange={(e) => onChange(e.target.checked)}
            aria-label={t('label')}
            className="h-4 w-4"
          />
          {t('receive')}
        </label>
      )}
    </div>
  );
}
