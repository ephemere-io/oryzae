import type { SupabaseClient, User } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import {
  computeOAuthNickname,
  ensureOAuthProfile,
  extractOAuthAvatarUrl,
  resolveMaxUserCountForOAuth,
} from '@/contexts/shared/presentation/helpers/ensure-oauth-profile.js';

function makeUser(overrides: Partial<User> = {}): User {
  // @type-assertion-allowed: テスト用に User の必要部分だけを満たすスタブを構築する。
  // SupabaseClient.auth.getUser() の返す User 型は内部フィールド多数で全て埋めると冗長。
  return {
    id: 'user_id_01234567',
    user_metadata: {},
    ...overrides,
  } as unknown as User;
}

interface MockOpts {
  existingProfile?: { nickname: string; avatar_url: string | null } | null;
  profileCount?: number;
}

interface MockHandles {
  client: SupabaseClient;
  insert: ReturnType<typeof vi.fn>;
  deleteUser: ReturnType<typeof vi.fn>;
  from: ReturnType<typeof vi.fn>;
}

function makeServiceSupabaseMock({
  existingProfile = null,
  profileCount = 0,
}: MockOpts): MockHandles {
  const insert = vi.fn().mockResolvedValue({ data: null, error: null });
  const deleteUser = vi.fn().mockResolvedValue({ data: null, error: null });

  const select = vi.fn((_cols: string, options?: { count?: string; head?: boolean }) => {
    if (options?.count === 'exact') {
      // count クエリ: そのまま await される
      return Promise.resolve({ count: profileCount, data: null, error: null });
    }
    // 通常 select: query builder を返す
    return {
      eq: () => ({
        single: () =>
          Promise.resolve({
            data: existingProfile,
            error: existingProfile ? null : { code: 'PGRST116', message: 'no rows' },
          }),
      }),
    };
  });

  const from = vi.fn(() => ({ select, insert }));

  // @type-assertion-allowed: SupabaseClient は内部多数のメソッドを持つが
  // ensureOAuthProfile が触る .from() と .auth.admin.deleteUser() だけ実装する。
  const client = {
    from,
    auth: { admin: { deleteUser } },
  } as unknown as SupabaseClient;

  return { client, insert, deleteUser, from };
}

describe('computeOAuthNickname', () => {
  it('full_name の空白を _ に変換', () => {
    expect(
      computeOAuthNickname(makeUser({ user_metadata: { full_name: 'Yoshitaka Nakajima' } })),
    ).toBe('Yoshitaka_Nakajima');
  });

  it('全角・複数空白も _ に変換', () => {
    expect(computeOAuthNickname(makeUser({ user_metadata: { full_name: 'a  b   c' } }))).toBe(
      'a_b_c',
    );
  });

  it('full_name が無ければ user_<id8> にフォールバック', () => {
    expect(computeOAuthNickname(makeUser({ id: 'abcdef1234567890', user_metadata: {} }))).toBe(
      'user_abcdef12',
    );
  });

  it('full_name が空文字でもフォールバック', () => {
    expect(
      computeOAuthNickname(
        makeUser({ id: 'abcdef1234567890', user_metadata: { full_name: '   ' } }),
      ),
    ).toBe('user_abcdef12');
  });

  it('30 文字で切る', () => {
    const long = 'a'.repeat(40);
    expect(computeOAuthNickname(makeUser({ user_metadata: { full_name: long } }))).toHaveLength(30);
  });
});

describe('extractOAuthAvatarUrl', () => {
  it('avatar_url が文字列ならそのまま返す', () => {
    expect(
      extractOAuthAvatarUrl(makeUser({ user_metadata: { avatar_url: 'https://x/a.png' } })),
    ).toBe('https://x/a.png');
  });

  it('avatar_url 無しなら null', () => {
    expect(extractOAuthAvatarUrl(makeUser({ user_metadata: {} }))).toBeNull();
  });

  it('avatar_url が文字列以外なら null', () => {
    expect(extractOAuthAvatarUrl(makeUser({ user_metadata: { avatar_url: 123 } }))).toBeNull();
  });
});

describe('resolveMaxUserCountForOAuth', () => {
  it('未設定なら 100', () => {
    expect(resolveMaxUserCountForOAuth({})).toBe(100);
  });
  it('正の整数文字列をパース', () => {
    expect(resolveMaxUserCountForOAuth({ MAX_USER_COUNT: '250' })).toBe(250);
  });
  it('非数値・0以下は 100', () => {
    expect(resolveMaxUserCountForOAuth({ MAX_USER_COUNT: 'abc' })).toBe(100);
    expect(resolveMaxUserCountForOAuth({ MAX_USER_COUNT: '0' })).toBe(100);
    expect(resolveMaxUserCountForOAuth({ MAX_USER_COUNT: '-5' })).toBe(100);
  });
});

describe('ensureOAuthProfile', () => {
  it('既存 profile があれば created: false で返す', async () => {
    const { client, insert, deleteUser } = makeServiceSupabaseMock({
      existingProfile: { nickname: 'existing_user', avatar_url: 'https://x/a.png' },
    });
    const result = await ensureOAuthProfile(client, makeUser(), 100);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.created).toBe(false);
      expect(result.profile).toEqual({ nickname: 'existing_user', avatarUrl: 'https://x/a.png' });
    }
    expect(insert).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('profile 無 & 枠余りなら user_metadata から作成', async () => {
    const { client, insert, deleteUser } = makeServiceSupabaseMock({
      existingProfile: null,
      profileCount: 5,
    });
    const user = makeUser({
      id: 'new_user_uuid_long',
      user_metadata: { full_name: 'New User', avatar_url: 'https://g/p.jpg' },
    });
    const result = await ensureOAuthProfile(client, user, 100);

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.created).toBe(true);
      expect(result.profile).toEqual({ nickname: 'New_User', avatarUrl: 'https://g/p.jpg' });
    }
    expect(insert).toHaveBeenCalledWith({
      id: 'new_user_uuid_long',
      nickname: 'New_User',
      avatar_url: 'https://g/p.jpg',
    });
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('profile 無 & 枠超過なら auth.users を巻き戻し capacity_reached', async () => {
    const { client, insert, deleteUser } = makeServiceSupabaseMock({
      existingProfile: null,
      profileCount: 100,
    });
    const user = makeUser({ id: 'late_user_id' });
    const result = await ensureOAuthProfile(client, user, 100);

    expect(result.status).toBe('capacity_reached');
    if (result.status === 'capacity_reached') {
      expect(result.limit).toBe(100);
    }
    expect(deleteUser).toHaveBeenCalledWith('late_user_id');
    expect(insert).not.toHaveBeenCalled();
  });

  it('profileCount === limit は capacity_reached（境界値）', async () => {
    const { client } = makeServiceSupabaseMock({ existingProfile: null, profileCount: 50 });
    const result = await ensureOAuthProfile(client, makeUser(), 50);
    expect(result.status).toBe('capacity_reached');
  });
});
