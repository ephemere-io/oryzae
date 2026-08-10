import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveRouteSkeleton } from '@/app/(protected)/_skeletons/route-skeleton';
import { AuthContext, type AuthContextValue } from '@/lib/auth-context';
import type { Device } from '@/lib/device';
import { DeviceProvider } from '@/lib/use-device';
import { I18nWrapper } from '../helpers/i18n-wrapper';

/**
 * 画面ごとのスケルトン（行き先で枠が変わること）を検証する。
 *
 * 直したかった不具合: 保護ルート全体で1枚のスケルトンを使い回していたため、/jar でも
 * /board でも「エントリ一覧の枠」が出ていた。ここでは **同じ端末でパスを変えたら
 * 別のユニットが描かれる** ことを DOM 契約（data-verify-unit）で確認する。
 */

const noopAuth: AuthContextValue = {
  auth: null,
  api: null,
  loading: false,
  login: async () => null,
  signup: async () => null,
  logout: () => {},
};

function unitsFor(pathname: string, device: Device): string[] {
  const element = resolveRouteSkeleton(pathname);
  if (element === null) return [];
  const { container } = render(
    <I18nWrapper>
      <AuthContext.Provider value={noopAuth}>
        <DeviceProvider initialDevice={device}>{element}</DeviceProvider>
      </AuthContext.Provider>
    </I18nWrapper>,
  );
  return Array.from(container.querySelectorAll('[data-verify-unit]')).map(
    (el) => el.getAttribute('data-verify-unit') ?? '',
  );
}

/** パス → 端末ごとに出るべきスケルトンのユニット名。 */
const EXPECTED: Array<{ path: string; pc: string; sp: string | null }> = [
  { path: '/entries', pc: 'EntryListSkeleton', sp: 'SpEntryListSkeleton' },
  { path: '/entries/new', pc: 'EntryEditorSkeleton', sp: 'SpEntryEditorSkeleton' },
  { path: '/entries/abc-123', pc: 'EntryEditorSkeleton', sp: 'SpEntryEditorSkeleton' },
  { path: '/jar', pc: 'JarViewSkeleton', sp: 'SpJarSkeleton' },
  // /board に SP 変種は無い → DeviceView が「スマホ未対応」表示にフォールバックする
  { path: '/board', pc: 'BoardViewSkeleton', sp: null },
  { path: '/questions', pc: 'QuestionTimelineSkeleton', sp: 'SpQuestionsSkeleton' },
  { path: '/account', pc: 'AccountPageSkeleton', sp: 'SpAccountPageSkeleton' },
];

describe('画面ごとのスケルトン（resolveRouteSkeleton）', () => {
  afterEach(() => cleanup());

  for (const { path, pc, sp } of EXPECTED) {
    it(`${path} (PC) は ${pc} を描く`, () => {
      expect(unitsFor(path, 'pc')).toContain(pc);
    });

    it(`${path} (SP) は ${sp ?? 'スケルトンなし（未対応表示）'}`, () => {
      const units = unitsFor(path, 'sp');
      if (sp === null) expect(units).toEqual([]);
      else expect(units).toContain(sp);
    });
  }

  it('一覧以外の画面に一覧のスケルトンを出さない（今回の不具合の再発防止）', () => {
    const listUnits = ['EntryListSkeleton', 'SpEntryListSkeleton'];
    for (const { path } of EXPECTED.filter((e) => e.path !== '/entries')) {
      for (const device of ['pc', 'sp'] as const) {
        const units = unitsFor(path, device);
        expect(
          units.filter((u) => listUnits.includes(u)),
          `${path} (${device}) に一覧のスケルトンが出ている`,
        ).toEqual([]);
        cleanup();
      }
    }
  });

  it('未知のパスでは何も描かない（間違った画面の枠を出すより良い）', () => {
    expect(resolveRouteSkeleton('/unknown')).toBeNull();
  });
});
