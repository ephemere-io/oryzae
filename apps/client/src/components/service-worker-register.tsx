'use client';

import { useEffect } from 'react';

/**
 * Service Worker（/sw.js）を登録する。Android Chrome で「インストール可能」と判定される
 * には fetch ハンドラを持つ SW の登録が必要なため。
 *
 * 本番のみ登録する（開発・テストでは古いキャッシュが貼り付く事故を避ける）。SW 自体は
 * ナビゲーションのオフラインフォールバックだけを担い、資産・API はキャッシュしない（安全既定）。
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    const register = () => {
      void navigator.serviceWorker.register('/sw.js').catch(() => {
        // 登録失敗は致命的ではない（PWA 非対応環境など）。握りつぶす。
      });
    };

    if (document.readyState === 'complete') {
      register();
      return;
    }
    window.addEventListener('load', register);
    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}
