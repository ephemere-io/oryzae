// verify-exempt: データ取得フック（use-newsletter-subscription）を内部で呼ぶため孤立検証に乗らない。
// 表示の契約は隣の newsletter-subscription-toggle.verify.tsx が固定している。
'use client';

import { useNewsletterSubscription } from '../hooks/use-newsletter-subscription';
import { NewsletterSubscriptionToggle } from './newsletter-subscription-toggle';

/**
 * アカウント設定の「お知らせメール」欄 (Issue #614)。
 *
 * ## なぜ shared に置くか
 *
 * PC と SP で体験が変わらない（1 行のトグル）。`pc/` と `sp/` に別々に書くと
 * 必ずコピーになるので、端末非依存 UI として features/shared に置いて両方から
 * import する（client-architecture-guide の決定木 4）。
 */
export function NewsletterSubscriptionSection() {
  const { optOut, saving, error, setOptOut } = useNewsletterSubscription();

  return (
    <NewsletterSubscriptionToggle
      subscribed={optOut === null ? null : !optOut}
      saving={saving}
      failed={error !== null}
      onChange={(subscribed) => setOptOut(!subscribed)}
    />
  );
}
