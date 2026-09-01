import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HomeGate } from '@/features/shared/auth/components/home-gate';
import { DOCS_SITE_URL } from '@/lib/docs-site';

/**
 * ルート（/）の振り分けゲート。公開ページを別ドメインの公開サイトへ移したことで、
 * このコンポーネントが「アプリ側 / に来た人をどこへ送るか」の唯一の判断点になった。
 *
 * 特に **Supabase のエラー hash の分岐**は落とすと実害が出る（期限切れリンクを踏んだ人が
 * 理由を見ないまま別ドメインへ飛ばされる）ため、経路ごとに固定する。
 */
const replace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
}));

const setTokens = vi.fn();
const getAccessToken = vi.fn();

vi.mock('@/lib/auth', () => ({
  setTokens: (a: string, r: string) => setTokens(a, r),
  getAccessToken: () => getAccessToken(),
}));

const locationReplace = vi.fn();

// jsdom の `window.location` は再定義できず spyOn が TypeError になるため、
// location ごと差し替える（window と globalThis は同一オブジェクト）。
function stubLocation(hash: string) {
  vi.stubGlobal('location', { hash, replace: locationReplace });
}

/** display-mode メディアクエリを差し替える（PWA 起動の再現。Issue #437）。 */
function setDisplayMode(standalone: boolean): void {
  // @type-assertion-allowed: jsdom の matchMedia スタブ。MediaQueryList の全メンバーは持たせない
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
}

beforeEach(() => {
  vi.clearAllMocks();
  getAccessToken.mockReturnValue(null);
  stubLocation('');
  setDisplayMode(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('HomeGate', () => {
  it('描画物を持たない', () => {
    const { container } = render(<HomeGate />);
    expect(container.innerHTML).toBe('');
  });

  it('hash のトークンを受けてログイン状態にし /entries/new へ送る', () => {
    stubLocation('#access_token=at&refresh_token=rt&type=signup');
    render(<HomeGate />);

    expect(setTokens).toHaveBeenCalledWith('at', 'rt');
    expect(replace).toHaveBeenCalledWith('/entries/new');
    expect(locationReplace).not.toHaveBeenCalled();
  });

  it('Supabase のエラー hash では確認画面へ送り、公開サイトへ離脱させない', () => {
    // 期限切れ・使用済みリンクはトークンではなくエラーで戻ってくる。ここで拾わないと
    // 「トークンも無い・未ログイン」と判定され、理由を見せないまま別ドメインへ飛ぶ。
    stubLocation(
      '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
    );
    render(<HomeGate />);

    expect(replace).toHaveBeenCalledWith('/auth/confirm?auth_error=otp_expired');
    expect(locationReplace).not.toHaveBeenCalled();
    expect(setTokens).not.toHaveBeenCalled();
  });

  it('error_code が無く error だけの hash でも確認画面へ送る', () => {
    stubLocation('#error=server_error');
    render(<HomeGate />);

    expect(replace).toHaveBeenCalledWith('/auth/confirm?auth_error=server_error');
    expect(locationReplace).not.toHaveBeenCalled();
  });

  it('既ログインなら /entries/new へ送る', () => {
    getAccessToken.mockReturnValue('existing-token');
    render(<HomeGate />);

    expect(replace).toHaveBeenCalledWith('/entries/new');
    expect(locationReplace).not.toHaveBeenCalled();
  });

  it('ブラウザで開いた未ログイン訪問者は公開サイトへ送る', () => {
    render(<HomeGate />);

    expect(locationReplace).toHaveBeenCalledWith(DOCS_SITE_URL);
    expect(replace).not.toHaveBeenCalled();
  });

  it('PWA から起動した未ログイン利用者はログイン画面へ送る（Issue #437）', () => {
    // ホーム画面のショートカットは古い start_url（＝ここ）のまま起動しうる。公開サイトを
    // 別ドメインに出したので、この分岐が無いとアプリに戻れないまま外へ飛ばされる。
    setDisplayMode(true);
    render(<HomeGate />);

    expect(replace).toHaveBeenCalledWith('/login');
    expect(locationReplace).not.toHaveBeenCalled();
  });

  it('PWA から起動したログイン済み利用者はエディタへ送る', () => {
    setDisplayMode(true);
    getAccessToken.mockReturnValue('existing-token');
    render(<HomeGate />);

    expect(replace).toHaveBeenCalledWith('/entries/new');
    expect(locationReplace).not.toHaveBeenCalled();
  });
});
