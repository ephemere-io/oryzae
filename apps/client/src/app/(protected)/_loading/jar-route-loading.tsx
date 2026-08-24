'use client';

import { DeviceView } from '@/components/device-view';
import { PageLoading } from '@/components/ui/page-loading';
import { SpJarSkeleton } from '@/features/sp/fermentation/components/sp-jar-skeleton';

/**
 * `/jar` のロード表示。同じ URL でも端末で画面の種類そのものが違うので、出すものも変える。
 *
 * - PC: 中央に瓶が浮かぶ**キャンバス**。並ぶコンテンツが無く、予告できる枠が無い
 *   （瓶の形を薄く描いても「これから出るレイアウト」の予告にはならず、本物が来た瞬間に
 *   全部差し替わるだけ）。素直に `PageLoading` を出す。
 * - SP: 届いた手紙の**一覧**。行の形が決まっているのでスケルトンが本来の役に立つ。
 */
export function JarRouteLoading() {
  return (
    <DeviceView
      sp={<SpJarSkeleton />}
      pc={
        <div className="absolute inset-0">
          <PageLoading />
        </div>
      }
    />
  );
}
