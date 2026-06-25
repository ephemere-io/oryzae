'use client';

import { useEffect, useState } from 'react';
import { DEVICE_COOKIE, DEVICE_PREF_COOKIE, type Device, isDevice } from '@/lib/device';

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * 解決済みの端末を返す。SSR / マウント前は `null`（判定前）。
 * 手動切替 `device-pref` があれば優先し、無ければ middleware が付与した `device` を読む。
 */
export function useDevice(): Device | null {
  const [device, setDevice] = useState<Device | null>(null);

  useEffect(() => {
    const pref = readCookie(DEVICE_PREF_COOKIE);
    if (isDevice(pref)) {
      setDevice(pref);
      return;
    }
    const detected = readCookie(DEVICE_COOKIE);
    setDevice(isDevice(detected) ? detected : 'pc');
  }, []);

  return device;
}
