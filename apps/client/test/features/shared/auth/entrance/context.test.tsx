import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  EntranceContext,
  useEntrance,
  useLeaveThroughEntrance,
} from '@/features/shared/auth/entrance/context';
import type { EntranceControls } from '@/features/shared/auth/types';

function withControls(controls: EntranceControls) {
  return ({ children }: { children: ReactNode }) => (
    <EntranceContext.Provider value={controls}>{children}</EntranceContext.Provider>
  );
}

describe('useEntrance', () => {
  it('扉の外（検証ハーネス・テスト）でも壊れず、enter はすぐ解決する', async () => {
    const { result } = renderHook(() => useEntrance());
    expect(() => result.current.setWaiting(true)).not.toThrow();
    // 解決しないと、ログイン後の遷移がいつまでも起きない。
    await expect(result.current.enter('/')).resolves.toBeUndefined();
  });
});

describe('useLeaveThroughEntrance', () => {
  it('行き先をそのまま扉に渡す', async () => {
    // 行き先ごとの判断（扉の手前へ戻るだけか・書斎へ渡すか）は扉の側が持つ
    // （`AuthEntrance` の `enter`）。呼び出し側は行き先を伝えるだけでよい。
    const enter = vi.fn(() => Promise.resolve());
    const { result } = renderHook(() => useLeaveThroughEntrance(), {
      wrapper: withControls({ compact: false, setWaiting: vi.fn(), enter }),
    });

    await result.current('/');
    expect(enter).toHaveBeenCalledWith('/');
  });
});
