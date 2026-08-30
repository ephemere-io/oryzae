import { HomeGate } from '@/features/auth/components/home-gate';

/**
 * ルート（/）= 振り分けゲート。描画物を持たない。
 *
 * ランディング・使い方・プライバシーポリシーは別リポジトリの公開サイト
 * （ephemere-io/oryzae-docs、docs.oryzae.ephemere.io）に移した。このアプリに残る `/` の
 * 責務は3つだけ:
 *   1. Supabase のメール確認リダイレクト（hash に access/refresh token）を受けてログインさせる
 *   2. 既ログインなら /entries/new へ送る
 *   3. どちらでもない訪問者を公開サイトへ送る
 *
 * いずれもクライアント側でしか判定できない（hash はサーバーに送られない、トークンは
 * localStorage にある）ため、HomeGate に集約している。middleware で noindex にしているので
 * このページがクロールされることはない。
 */
export default function HomePage() {
  return <HomeGate />;
}
