import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HomeGate } from '@/features/landing/components/home-gate';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

/** display-mode メディアクエリを差し替える（PWA 起動の再現）。 */
function setDisplayMode(standalone: boolean): void {
  window.matchMedia = vi.fn((query: string) => ({
    matches: standalone && query === '(display-mode: standalone)',
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
  // @type-assertion-allowed: jsdom の matchMedia スタブ。MediaQueryList の全メンバーは持たせない
}

describe('HomeGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    window.location.hash = '';
    setDisplayMode(false);
  });

  afterEach(cleanup);

  it('ログイン済みならエディタへ送る', () => {
    localStorage.setItem('oryzae_access_token', 'token');
    render(<HomeGate />);
    expect(replace).toHaveBeenCalledWith('/entries/new');
  });

  it('ブラウザで開いた未ログイン訪問者はランディングのまま（リダイレクトしない）', () => {
    render(<HomeGate />);
    expect(replace).not.toHaveBeenCalled();
  });

  it('PWA から起動した未ログイン利用者はログイン画面へ送る（Issue #437）', () => {
    // ホーム画面のショートカットは古い start_url（＝ランディング）のまま起動しうる。
    setDisplayMode(true);
    render(<HomeGate />);
    expect(replace).toHaveBeenCalledWith('/login');
  });

  it('PWA から起動したログイン済み利用者はエディタへ送る', () => {
    setDisplayMode(true);
    localStorage.setItem('oryzae_access_token', 'token');
    render(<HomeGate />);
    expect(replace).toHaveBeenCalledWith('/entries/new');
  });
});
