import type {
  DeleteUserDataRepositoryGateway,
  DeleteUserDataResult,
} from '../../domain/gateways/delete-user-data-repository.gateway.js';
import { AuthUserNotFoundError, CannotDeleteSelfError } from '../errors/user.errors.js';

interface DeleteUserAdminInput {
  /** 削除対象のユーザー ID */
  targetUserId: string;
  /** 操作を実行している管理者の ID */
  requesterUserId: string;
}

/**
 * Issue #326: 管理画面からテストアカウントとその関連データを一括削除する。
 *
 * 削除順:
 *   1. public.* の関連行 (entries, questions, fermentation_results, boards, profiles, ...)
 *   2. storage の関連オブジェクト (avatars/, board-photos/)
 *   3. auth.users 本体
 *
 * Supabase Dashboard の Auth → Users 削除は "Database error deleting user" で
 * 失敗するケースがあるため、CASCADE に頼らず明示的に消してから auth を消す。
 */
export class DeleteUserAdminUsecase {
  constructor(private repo: DeleteUserDataRepositoryGateway) {}

  async execute(input: DeleteUserAdminInput): Promise<DeleteUserDataResult> {
    if (input.targetUserId === input.requesterUserId) {
      throw new CannotDeleteSelfError();
    }

    const email = await this.repo.findAuthUserEmail(input.targetUserId);
    if (email === null) {
      throw new AuthUserNotFoundError(input.targetUserId);
    }

    await this.repo.deletePublicData(input.targetUserId);
    await this.repo.deleteStorageObjects(input.targetUserId);
    await this.repo.deleteAuthUser(input.targetUserId);

    return { userId: input.targetUserId, email };
  }
}
