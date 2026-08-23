import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AccountRoute from '@/app/(protected)/account/page';
import BoardPage from '@/app/(protected)/board/page';
import EntryDetailPage from '@/app/(protected)/entries/[id]/page';
import { AuthContext, type AuthContextValue } from '@/lib/auth-context';
import type { Device } from '@/lib/device';
import { DeviceProvider } from '@/lib/use-device';
import { I18nWrapper } from '../helpers/i18n-wrapper';

/**
 * 認証・データの解決待ちで **page が空を返さない**ことを検証する。
 *
 * 直したかった不具合: これらの page は `if (loading) return null` で真っ白を返していた。
 * レイアウトが mount 前に出すロード表示 → mount → **真っ白** → 本体、という順になり、
 * 直前まで出ていた枠が一度消える（ハードリロード時に必ず通る。クライアント遷移では
 * 認証が解決済みなのでガードを素通りするため出ない）。
 *
 * ロード中も対応する `*RouteLoading` を出し続けることで、表示が途切れなくなる。
 */

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useParams: () => ({ id: 'e-1' }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}));

/** 認証解決前の状態（restoreSession が走っている最中）。 */
const loadingAuth: AuthContextValue = {
  auth: null,
  api: null,
  loading: true,
  login: async () => null,
  signup: async () => null,
  logout: () => {},
};

type PageComponent = () => React.ReactNode;

function renderPage(Page: PageComponent, device: Device) {
  return render(
    <I18nWrapper>
      <AuthContext.Provider value={loadingAuth}>
        <DeviceProvider initialDevice={device}>
          <Page />
        </DeviceProvider>
      </AuthContext.Provider>
    </I18nWrapper>,
  );
}

const CASES: Array<{
  name: string;
  Page: PageComponent;
  /** PC で出るべき目印（スケルトンのユニット名 or PageLoading）。 */
  pc: { unit: string } | 'loading';
}> = [
  { name: '/board', Page: BoardPage, pc: 'loading' },
  { name: '/account', Page: AccountRoute, pc: { unit: 'AccountPageSkeleton' } },
  { name: '/entries/[id]', Page: EntryDetailPage, pc: { unit: 'EntryEditorSkeleton' } },
];

describe('保護 page は解決待ちに空を返さない', () => {
  afterEach(() => cleanup());

  for (const { name, Page, pc } of CASES) {
    it(`${name} (PC) は認証解決前でもロード表示を出す`, () => {
      const { container } = renderPage(Page, 'pc');

      expect(container.innerHTML, `${name} が空を返している`).not.toBe('');
      if (pc === 'loading') {
        expect(container.querySelector('[data-testid="page-loading"]')).not.toBeNull();
      } else {
        expect(container.querySelector(`[data-verify-unit="${pc.unit}"]`)).not.toBeNull();
      }
    });
  }

  it('/account (SP) も認証解決前に空を返さない', () => {
    const { container } = renderPage(AccountRoute, 'sp');
    expect(container.querySelector('[data-verify-unit="SpAccountPageSkeleton"]')).not.toBeNull();
  });
});
