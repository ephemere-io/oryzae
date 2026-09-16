'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { UnsubscribePanel } from '@/features/shared/newsletter/components/unsubscribe-panel';
import { useNewsletterUnsubscribe } from '@/features/shared/newsletter/hooks/use-newsletter-unsubscribe';

/**
 * お知らせメールの配信停止 (Issue #614)。
 *
 * **保護ルートの外**に置いてある。止めたいのはログインしていない人で、
 * ログインを挟むと実質「止められない」に等しくなるため。本人性はメールに載せた
 * 署名付きトークン（`?token=`）だけで担保する。
 *
 * 端末で体験が変わる画面ではないので DeviceView は使わない
 * （`protected-pages-use-device-view` の対象も (protected) 配下のみ）。
 */
function UnsubscribeContent() {
  const token = useSearchParams().get('token');
  const { state, resubscribe } = useNewsletterUnsubscribe(token);

  return <UnsubscribePanel state={state} onResubscribe={resubscribe} />;
}

export default function UnsubscribeRoute() {
  // useSearchParams は静的プリレンダリングを止めるため Suspense が要る。
  return (
    <Suspense fallback={null}>
      <UnsubscribeContent />
    </Suspense>
  );
}
