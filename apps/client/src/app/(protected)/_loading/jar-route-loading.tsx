'use client';

import { DeviceView } from '@/components/device-view';
import { PageLoading } from '@/components/ui/page-loading';

/**
 * `/jar` のロード表示。PC も SP も `PageLoading`。
 *
 * 瓶は方眼の上に壜と問いの円が散らばる**キャンバス**で、円の位置は問いごとにサーバーに保存されている。
 * 枠を先に置いても位置が当たらず、予告にならない（ボードと同じ理由。`board-route-loading.tsx`）。
 *
 * SP は以前「壜のまわりを問いが回る」形だった頃のスケルトン（灰色の壜と、まわりに小さな円 3 つ）を
 * 出していた。瓶を今の形（方眼・線画の壜・大きな円）に変えたあとも残っていて、開くたびに**前の画面の
 * 形が一瞬出る**ように見えていた（実機レビュー #616: 「瓶画面を開く時に、以前作った回転表示の痕跡が
 * 一瞬表示される」）。
 */
export function JarRouteLoading() {
  const loading = (
    <div className="absolute inset-0">
      <PageLoading />
    </div>
  );
  return <DeviceView pc={loading} sp={loading} />;
}
