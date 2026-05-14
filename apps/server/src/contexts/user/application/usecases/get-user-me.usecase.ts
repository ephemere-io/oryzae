import type { UserActivityStatsRepositoryGateway } from '../../domain/gateways/user-activity-stats-repository.gateway.js';
import type { UserProfileRepositoryGateway } from '../../domain/gateways/user-profile-repository.gateway.js';
import { UserProfileNotFoundError } from '../errors/user.errors.js';

interface UserMeView {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  onboardingCompleted: boolean;
  /** 一度でも漬け込んだエントリがあるか (Issue #316 ガイドモーダル用) */
  hasPickled: boolean;
  /** 一度でもエントリに問いを紐付けたことがあるか (Issue #316 ガイドモーダル用) */
  hasLinkedQuestion: boolean;
}

/**
 * GET /api/v1/users/me が返す View を組み立てる usecase。
 *
 * Issue #316 のガイドモーダル (まだ漬け込んでいない/まだ問いを紐付けていない使用者へ
 * 案内する) は、これら 2 フラグと onboardingCompleted を客戸側で組み合わせて
 * 表示判定する。集計は user 側 port の {@link UserActivityStatsRepositoryGateway}
 * を介して行い、entry / question コンテキストへの参照は持たない。
 */
export class GetUserMeUsecase {
  constructor(
    private profileRepo: UserProfileRepositoryGateway,
    private statsRepo: UserActivityStatsRepositoryGateway,
  ) {}

  async execute(userId: string): Promise<UserMeView> {
    const profile = await this.profileRepo.findById(userId);
    if (!profile) throw new UserProfileNotFoundError(userId);

    const [hasPickled, hasLinkedQuestion] = await Promise.all([
      this.statsRepo.hasPickled(userId),
      this.statsRepo.hasLinkedQuestion(userId),
    ]);

    const props = profile.toProps();
    return {
      id: props.id,
      nickname: props.nickname,
      avatarUrl: props.avatarUrl,
      onboardingCompleted: props.onboardingCompleted,
      hasPickled,
      hasLinkedQuestion,
    };
  }
}
