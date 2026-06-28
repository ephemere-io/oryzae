import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Device } from '@/lib/device';
import { DeviceProvider, useDevice } from '@/lib/use-device';

/**
 * useDevice はサーバーが確定した端末を供給する Context の consumer。
 * 端末解決の precedence（pref ?? UA）は middleware/`resolveDevice` 側でテストする
 * （test/lib/device.test.ts）。ここは「供給された値をそのまま返す」ことだけを担保する。
 */
function wrapper(initialDevice: Device) {
  return ({ children }: { children: React.ReactNode }) => (
    <DeviceProvider initialDevice={initialDevice}>{children}</DeviceProvider>
  );
}

describe('useDevice', () => {
  it('Provider が供給した端末(sp)をそのまま返す', () => {
    const { result } = renderHook(() => useDevice(), { wrapper: wrapper('sp') });
    expect(result.current).toBe('sp');
  });

  it('Provider が供給した端末(pc)をそのまま返す', () => {
    const { result } = renderHook(() => useDevice(), { wrapper: wrapper('pc') });
    expect(result.current).toBe('pc');
  });

  it('Provider の外では null（保険のフォールバック）', () => {
    const { result } = renderHook(() => useDevice());
    expect(result.current).toBeNull();
  });
});
