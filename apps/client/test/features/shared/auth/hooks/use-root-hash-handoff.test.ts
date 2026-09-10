import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRootHashHandoff } from '@/features/shared/auth/hooks/use-root-hash-handoff';

/**
 * ルート（/）に届いたメールリンクの hash の引き継ぎ。以前は `/` の `HomeGate` が持っていて、
 * `/` が書斎（保護ルート）になったので保護レイアウトがこの hook で引き継いだ。
 *
 * **エラー分岐は落とすと実害が出る**（期限切れリンクを踏んだ人が理由を見ないまま
 * ログイン画面へ流される）ので、経路ごとに固定する。
 */
const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

const setTokens = vi.fn();
vi.mock('@/lib/auth', () => ({
  setTokens: (access: string, refresh: string) => setTokens(access, refresh),
}));

const locationReplace = vi.fn();

// jsdom の `window.location` は再定義できず spyOn が TypeError になるため、location ごと差し替える。
function stubHash(hash: string): void {
  vi.stubGlobal('location', { hash, replace: locationReplace });
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('useRootHashHandoff', () => {
  it('hash のトークンを保存し、読み込み直して / に入る（認証を立ち上げ直す）', () => {
    stubHash('#access_token=at&refresh_token=rt&type=signup');
    const { result } = renderHook(() => useRootHashHandoff(true));

    expect(setTokens).toHaveBeenCalledWith('at', 'rt');
    expect(locationReplace).toHaveBeenCalledWith('/');
    expect(result.current.current).toBe(true);
  });

  it('期限切れ・使用済みのリンクは確認画面へ回し、ログイン画面へ流さない', () => {
    stubHash('#error=access_denied&error_code=otp_expired&error_description=expired');
    const { result } = renderHook(() => useRootHashHandoff(true));

    expect(replace).toHaveBeenCalledWith('/auth/confirm?auth_error=otp_expired');
    expect(setTokens).not.toHaveBeenCalled();
    // 引き継ぎ中の印。呼び出し側はこれを見てログインへ送らない。
    expect(result.current.current).toBe(true);
  });

  it('error_code が無く error だけの hash でも確認画面へ回す', () => {
    stubHash('#error=server_error');
    renderHook(() => useRootHashHandoff(true));

    expect(replace).toHaveBeenCalledWith('/auth/confirm?auth_error=server_error');
  });

  it('hash が無ければ何もしない（ログインへ送る判断は呼び出し側に任せる）', () => {
    stubHash('');
    const { result } = renderHook(() => useRootHashHandoff(true));

    expect(setTokens).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(locationReplace).not.toHaveBeenCalled();
    expect(result.current.current).toBe(false);
  });

  it('/ 以外の画面の hash は読まない', () => {
    stubHash('#access_token=at&refresh_token=rt');
    renderHook(() => useRootHashHandoff(false));

    expect(setTokens).not.toHaveBeenCalled();
    expect(locationReplace).not.toHaveBeenCalled();
  });
});
