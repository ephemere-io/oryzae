import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserProfileNotFoundError } from '@/contexts/user/application/errors/user.errors';
import { GetUserMeUsecase } from '@/contexts/user/application/usecases/get-user-me.usecase';
import type { UserActivityStatsRepositoryGateway } from '@/contexts/user/domain/gateways/user-activity-stats-repository.gateway';
import type { UserProfileRepositoryGateway } from '@/contexts/user/domain/gateways/user-profile-repository.gateway';
import { UserProfile } from '@/contexts/user/domain/models/user-profile';

describe('GetUserMeUsecase', () => {
  let profileRepo: UserProfileRepositoryGateway;
  let statsRepo: UserActivityStatsRepositoryGateway;
  let usecase: GetUserMeUsecase;

  const baseProfile = UserProfile.fromProps({
    id: 'user-1',
    nickname: 'taro',
    avatarUrl: null,
    onboardingCompleted: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });

  beforeEach(() => {
    profileRepo = {
      findById: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockResolvedValue(undefined),
      count: vi.fn().mockResolvedValue(0),
    };
    statsRepo = {
      hasPickled: vi.fn().mockResolvedValue(false),
      hasLinkedQuestion: vi.fn().mockResolvedValue(false),
      hasQuestion: vi.fn().mockResolvedValue(false),
      hasEntry: vi.fn().mockResolvedValue(false),
      hasReadLetter: vi.fn().mockResolvedValue(false),
    };
    usecase = new GetUserMeUsecase(profileRepo, statsRepo);
  });

  it('プロフィールと集計フラグ (すべて false) を返す', async () => {
    vi.mocked(profileRepo.findById).mockResolvedValue(baseProfile);

    const view = await usecase.execute('user-1');

    expect(view).toEqual({
      id: 'user-1',
      nickname: 'taro',
      avatarUrl: null,
      onboardingCompleted: true,
      hasPickled: false,
      hasLinkedQuestion: false,
      hasQuestion: false,
      hasEntry: false,
      hasReadLetter: false,
    });
    expect(statsRepo.hasPickled).toHaveBeenCalledWith('user-1');
    expect(statsRepo.hasLinkedQuestion).toHaveBeenCalledWith('user-1');
    expect(statsRepo.hasQuestion).toHaveBeenCalledWith('user-1');
    expect(statsRepo.hasEntry).toHaveBeenCalledWith('user-1');
    expect(statsRepo.hasReadLetter).toHaveBeenCalledWith('user-1');
  });

  it('一度でも漬け込んでいれば hasPickled=true', async () => {
    vi.mocked(profileRepo.findById).mockResolvedValue(baseProfile);
    vi.mocked(statsRepo.hasPickled).mockResolvedValue(true);

    const view = await usecase.execute('user-1');

    expect(view.hasPickled).toBe(true);
    expect(view.hasLinkedQuestion).toBe(false);
  });

  it('一度でも問いを紐付けていれば hasLinkedQuestion=true', async () => {
    vi.mocked(profileRepo.findById).mockResolvedValue(baseProfile);
    vi.mocked(statsRepo.hasLinkedQuestion).mockResolvedValue(true);

    const view = await usecase.execute('user-1');

    expect(view.hasPickled).toBe(false);
    expect(view.hasLinkedQuestion).toBe(true);
  });

  it('問いを 1 件でも立てていれば hasQuestion=true（五歩の ①）', async () => {
    vi.mocked(profileRepo.findById).mockResolvedValue(baseProfile);
    vi.mocked(statsRepo.hasQuestion).mockResolvedValue(true);

    const view = await usecase.execute('user-1');

    expect(view.hasQuestion).toBe(true);
    // ① だけ済んで ②〜⑤ はまだ、という組み合わせがそのまま返る
    expect(view.hasEntry).toBe(false);
    expect(view.hasLinkedQuestion).toBe(false);
    expect(view.hasPickled).toBe(false);
    expect(view.hasReadLetter).toBe(false);
  });

  it('エントリを 1 件でも書いていれば hasEntry=true（五歩の ②）', async () => {
    vi.mocked(profileRepo.findById).mockResolvedValue(baseProfile);
    vi.mocked(statsRepo.hasEntry).mockResolvedValue(true);

    const view = await usecase.execute('user-1');

    expect(view.hasEntry).toBe(true);
    // 書いただけで漬け込んではいない、がそのまま返る（② と ④ は別の旗）
    expect(view.hasPickled).toBe(false);
  });

  it('手紙を 1 通でも開いていれば（read_at あり）hasReadLetter=true（五歩の ⑤）', async () => {
    vi.mocked(profileRepo.findById).mockResolvedValue(baseProfile);
    vi.mocked(statsRepo.hasReadLetter).mockResolvedValue(true);

    const view = await usecase.execute('user-1');

    expect(view.hasReadLetter).toBe(true);
    expect(view.hasPickled).toBe(false);
  });

  it('プロフィールが無ければ UserProfileNotFoundError を throw する', async () => {
    await expect(usecase.execute('missing-user')).rejects.toThrow(UserProfileNotFoundError);
    expect(statsRepo.hasPickled).not.toHaveBeenCalled();
    expect(statsRepo.hasLinkedQuestion).not.toHaveBeenCalled();
    expect(statsRepo.hasQuestion).not.toHaveBeenCalled();
    expect(statsRepo.hasEntry).not.toHaveBeenCalled();
    expect(statsRepo.hasReadLetter).not.toHaveBeenCalled();
  });
});
