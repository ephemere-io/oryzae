import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveRouteLoading } from '@/app/(protected)/_loading/route-loading';
import { AuthContext, type AuthContextValue } from '@/lib/auth-context';
import type { Device } from '@/lib/device';
import { DeviceProvider } from '@/lib/use-device';
import { I18nWrapper } from '../helpers/i18n-wrapper';

/**
 * 画面ごとのロード表示（行き先で出るものが変わること）を検証する。
 *
 * 直したかった不具合は2つ:
 *  1. 保護ルート全体で1枚を使い回していたため、/jar でも /board でも「エントリ一覧の枠」が出た
 *  2. その反動で、レイアウトを予告できないキャンバス画面にまで枠を並べてしまっていた
 *     （瓶やボードは枠を置いても位置が当たらず、予告になっていない）
 *
 * ここでは **同じ端末でパスを変えたら出るものが変わる**ことと、
 * **キャンバス画面ではスケルトンではなく PageLoading が出る**ことを DOM で確認する。
 */

const noopAuth: AuthContextValue = {
  auth: null,
  api: null,
  loading: false,
  login: async () => null,
  signup: async () => null,
  logout: () => {},
};

interface Rendered {
  units: string[];
  hasPageLoading: boolean;
}

function renderFor(pathname: string, device: Device): Rendered {
  const element = resolveRouteLoading(pathname);
  if (element === null) return { units: [], hasPageLoading: false };
  const { container } = render(
    <I18nWrapper>
      <AuthContext.Provider value={noopAuth}>
        <DeviceProvider initialDevice={device}>{element}</DeviceProvider>
      </AuthContext.Provider>
    </I18nWrapper>,
  );
  return {
    units: Array.from(container.querySelectorAll('[data-verify-unit]')).map(
      (el) => el.getAttribute('data-verify-unit') ?? '',
    ),
    hasPageLoading: Boolean(container.querySelector('[data-testid="page-loading"]')),
  };
}

/**
 * パス → 端末ごとに出るべきもの。
 * `skeleton` はそのユニット名、`loading` は PageLoading、`null` は何も出さない。
 */
const EXPECTED: Array<{
  path: string;
  pc: { skeleton: string } | 'loading';
  sp: { skeleton: string } | 'loading' | null;
}> = [
  {
    path: '/entries',
    pc: { skeleton: 'EntryListSkeleton' },
    sp: { skeleton: 'SpEntryListSkeleton' },
  },
  {
    path: '/entries/new',
    pc: { skeleton: 'EntryEditorSkeleton' },
    sp: { skeleton: 'SpEntryEditorSkeleton' },
  },
  {
    path: '/entries/abc-123',
    pc: { skeleton: 'EntryEditorSkeleton' },
    sp: { skeleton: 'SpEntryEditorSkeleton' },
  },
  // PC の瓶はキャンバス（予告できる枠が無い）。SP の瓶は手紙の一覧なのでスケルトン。
  { path: '/jar', pc: 'loading', sp: { skeleton: 'SpJarSkeleton' } },
  // ボードもキャンバス。SP 変種は無いので DeviceView が「未対応」表示にフォールバックする。
  { path: '/board', pc: 'loading', sp: null },
  {
    path: '/questions',
    pc: { skeleton: 'QuestionTimelineSkeleton' },
    sp: { skeleton: 'SpQuestionsSkeleton' },
  },
  {
    path: '/account',
    pc: { skeleton: 'AccountPageSkeleton' },
    sp: { skeleton: 'SpAccountPageSkeleton' },
  },
];

function label(expected: { skeleton: string } | 'loading' | null): string {
  if (expected === null) return 'ロード表示なし（未対応表示）';
  return expected === 'loading' ? 'PageLoading' : expected.skeleton;
}

describe('画面ごとのロード表示（resolveRouteLoading）', () => {
  afterEach(() => cleanup());

  for (const { path, pc, sp } of EXPECTED) {
    for (const [device, expected] of [
      ['pc', pc],
      ['sp', sp],
    ] as const) {
      it(`${path} (${device}) は ${label(expected)}`, () => {
        const { units, hasPageLoading } = renderFor(path, device);
        if (expected === null) {
          expect(units).toEqual([]);
          expect(hasPageLoading).toBe(false);
        } else if (expected === 'loading') {
          expect(hasPageLoading).toBe(true);
          expect(units).toEqual([]);
        } else {
          expect(units).toContain(expected.skeleton);
        }
      });
    }
  }

  it('一覧以外の画面に一覧のスケルトンを出さない（不具合1の再発防止）', () => {
    const listUnits = ['EntryListSkeleton', 'SpEntryListSkeleton'];
    for (const { path } of EXPECTED.filter((e) => e.path !== '/entries')) {
      for (const device of ['pc', 'sp'] as const) {
        const { units } = renderFor(path, device);
        expect(
          units.filter((u) => listUnits.includes(u)),
          `${path} (${device}) に一覧のスケルトンが出ている`,
        ).toEqual([]);
        cleanup();
      }
    }
  });

  it('キャンバス画面はスケルトンを1つも持たない（不具合2の再発防止）', () => {
    for (const path of ['/jar', '/board']) {
      const { units, hasPageLoading } = renderFor(path, 'pc');
      expect(units, `${path} (pc) に予告できない枠が出ている`).toEqual([]);
      expect(hasPageLoading).toBe(true);
      cleanup();
    }
  });

  it('未知のパスでは何も描かない（間違った画面のロード表示より良い）', () => {
    expect(resolveRouteLoading('/unknown')).toBeNull();
  });
});
