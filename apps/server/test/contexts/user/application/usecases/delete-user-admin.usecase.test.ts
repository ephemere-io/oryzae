import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AuthUserNotFoundError,
  CannotDeleteSelfError,
} from '@/contexts/user/application/errors/user.errors';
import { DeleteUserAdminUsecase } from '@/contexts/user/application/usecases/delete-user-admin.usecase';
import type { DeleteUserDataRepositoryGateway } from '@/contexts/user/domain/gateways/delete-user-data-repository.gateway';

describe('DeleteUserAdminUsecase', () => {
  let repo: DeleteUserDataRepositoryGateway;
  let usecase: DeleteUserAdminUsecase;

  beforeEach(() => {
    repo = {
      findAuthUserEmail: vi.fn().mockResolvedValue('test@example.com'),
      deletePublicData: vi.fn().mockResolvedValue(undefined),
      deleteStorageObjects: vi.fn().mockResolvedValue(undefined),
      deleteAuthUser: vi.fn().mockResolvedValue(undefined),
    };
    usecase = new DeleteUserAdminUsecase(repo);
  });

  it('public → storage → auth.users の順で削除する', async () => {
    const calls: string[] = [];
    vi.mocked(repo.deletePublicData).mockImplementation(async () => {
      calls.push('public');
    });
    vi.mocked(repo.deleteStorageObjects).mockImplementation(async () => {
      calls.push('storage');
    });
    vi.mocked(repo.deleteAuthUser).mockImplementation(async () => {
      calls.push('auth');
    });

    const result = await usecase.execute({
      targetUserId: 'target-1',
      requesterUserId: 'admin-1',
    });

    expect(calls).toEqual(['public', 'storage', 'auth']);
    expect(repo.deletePublicData).toHaveBeenCalledWith('target-1');
    expect(repo.deleteStorageObjects).toHaveBeenCalledWith('target-1');
    expect(repo.deleteAuthUser).toHaveBeenCalledWith('target-1');
    expect(result).toEqual({ userId: 'target-1', email: 'test@example.com' });
  });

  it('自分自身を削除しようとすると CannotDeleteSelfError を throw する', async () => {
    await expect(
      usecase.execute({ targetUserId: 'admin-1', requesterUserId: 'admin-1' }),
    ).rejects.toThrow(CannotDeleteSelfError);

    expect(repo.findAuthUserEmail).not.toHaveBeenCalled();
    expect(repo.deletePublicData).not.toHaveBeenCalled();
    expect(repo.deleteStorageObjects).not.toHaveBeenCalled();
    expect(repo.deleteAuthUser).not.toHaveBeenCalled();
  });

  it('auth.users に存在しないユーザーは AuthUserNotFoundError を throw する', async () => {
    vi.mocked(repo.findAuthUserEmail).mockResolvedValue(null);

    await expect(
      usecase.execute({ targetUserId: 'missing', requesterUserId: 'admin-1' }),
    ).rejects.toThrow(AuthUserNotFoundError);

    expect(repo.deletePublicData).not.toHaveBeenCalled();
    expect(repo.deleteStorageObjects).not.toHaveBeenCalled();
    expect(repo.deleteAuthUser).not.toHaveBeenCalled();
  });

  it('email が空文字でも削除を進める (Supabase auth は email 必須でない)', async () => {
    vi.mocked(repo.findAuthUserEmail).mockResolvedValue('');

    const result = await usecase.execute({
      targetUserId: 'target-1',
      requesterUserId: 'admin-1',
    });

    expect(result).toEqual({ userId: 'target-1', email: '' });
    expect(repo.deleteAuthUser).toHaveBeenCalledWith('target-1');
  });

  it('public データ削除中にエラーが出たら storage / auth は呼ばずに throw する', async () => {
    vi.mocked(repo.deletePublicData).mockRejectedValue(new Error('boom'));

    await expect(
      usecase.execute({ targetUserId: 'target-1', requesterUserId: 'admin-1' }),
    ).rejects.toThrow('boom');

    expect(repo.deleteStorageObjects).not.toHaveBeenCalled();
    expect(repo.deleteAuthUser).not.toHaveBeenCalled();
  });
});
