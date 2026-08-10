'use client';

import { DeviceView } from '@/components/device-view';
import { JarViewSkeleton } from '@/features/pc/fermentation/components/jar-view-skeleton';
import { SpJarSkeleton } from '@/features/sp/fermentation/components/sp-jar-skeleton';

/**
 * `/jar` のロード枠。PC は全面キャンバス（page も `absolute inset-0` で敷いている）、
 * SP は手紙の受信箱。同じ URL でも形が全く違うので、端末で必ず出し分ける。
 */
export function JarRouteSkeleton() {
  return (
    <DeviceView
      sp={<SpJarSkeleton />}
      pc={
        <div className="absolute inset-0">
          <JarViewSkeleton />
        </div>
      }
    />
  );
}
