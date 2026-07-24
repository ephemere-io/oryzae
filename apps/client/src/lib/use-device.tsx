'use client';

import { createContext, useContext } from 'react';
import type { Device } from '@/lib/device';

const DeviceContext = createContext<Device | null>(null);

/**
 * 端末をアプリ全体に供給する（Issue #363 perf）。`initialDevice` はサーバーが
 * middleware の `x-device` ヘッダ（= device-pref ?? UA 判定）から確定済みなので、
 * SSR と client first render が一致し hydration mismatch にならない。これにより
 * 端末別シェル＋スケルトンを SSR で即描画でき、JS/認証を待たず FCP が出る。
 * （以前は cookie をクライアントで読み mount まで null だったため SSR が空だった）。
 */
export function DeviceProvider({
  initialDevice,
  children,
}: {
  initialDevice: Device;
  children: React.ReactNode;
}) {
  return <DeviceContext.Provider value={initialDevice}>{children}</DeviceContext.Provider>;
}

/** 解決済みの端末を返す。Provider 配下では常に非 null（サーバーが確定済み）。 */
export function useDevice(): Device | null {
  return useContext(DeviceContext);
}
