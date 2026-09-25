import { notFound } from 'next/navigation';
import { ViewportReadout } from './viewport-readout';

/**
 * ビューポートの実測（dev/preview 限定。真の本番のみ 404）。
 *
 * 下のツールバーを重ねて描くブラウザ（アプリ内ブラウザ）が、どの値なら隠れている高さを
 * 教えてくれるのかを実機で確かめるための画面。`/verify` と同じ扱いにする。
 */
export default function VerifyViewportPage() {
  if (process.env.NODE_ENV === 'production' && process.env.VERCEL_ENV !== 'preview') notFound();
  return <ViewportReadout />;
}
