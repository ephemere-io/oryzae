// Oryzae の最小 Service Worker（PWA インストール可能化のため）。
// 方針: 資産・API は一切キャッシュしない（古い内容が貼り付く事故を防ぐ network 優先）。
// ナビゲーション要求が失敗したとき（オフライン）のみ /offline.html を返す。
// オフライン用キャッシュは offline.html ひとつだけ。

const CACHE = 'oryzae-offline-v1';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(OFFLINE_URL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // ページ遷移（ドキュメント取得）のみ介入。それ以外はブラウザ既定に任せる（キャッシュしない）。
  if (request.mode !== 'navigate') return;

  event.respondWith(
    (async () => {
      try {
        return await fetch(request);
      } catch {
        const cache = await caches.open(CACHE);
        const fallback = await cache.match(OFFLINE_URL);
        return fallback ?? Response.error();
      }
    })(),
  );
});
