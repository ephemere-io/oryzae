import type { UserActivityStatsRepositoryGateway } from '../../domain/gateways/user-activity-stats-repository.gateway.js';
import type { UserProfileRepositoryGateway } from '../../domain/gateways/user-profile-repository.gateway.js';
import { UserProfileNotFoundError } from '../errors/user.errors.js';

interface UserMeView {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  onboardingCompleted: boolean;
  /** 一度でも漬け込んだエントリがあるか。ヘルプの五歩 ④「瓶に漬けて待つ」の旗 (Issue #316 由来) */
  hasPickled: boolean;
  /** 一度でもエントリに問いを紐付けたことがあるか。ヘルプの五歩 ③「問いを紐づける」の旗 (Issue #316 由来) */
  hasLinkedQuestion: boolean;
  /**
   * 問いを 1 件でも立てたことがあるか（アーカイブ済み含む）。
   * ヘルプの五歩 ①「問いを立てる」が済んだかの旗。
   */
  hasQuestion: boolean;
  /** エントリを 1 件でも書いたことがあるか。ヘルプの五歩 ②「エントリーを書く」の旗。 */
  hasEntry: boolean;
  /**
   * 手紙を 1 通でも読んだことがあるか。ヘルプの五歩 ⑤「手紙を読む」の旗。
   * 実体は `fermentation_results.read_at` が埋まった行の有無
   * （{@link UserActivityStatsRepositoryGateway.hasReadLetter} の注記を参照）。
   */
  hasReadLetter: boolean;
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

    const [hasPickled, hasLinkedQuestion, hasQuestion, hasEntry, hasReadLetter] = await Promise.all(
      [
        this.statsRepo.hasPickled(userId),
        this.statsRepo.hasLinkedQuestion(userId),
        this.statsRepo.hasQuestion(userId),
        this.statsRepo.hasEntry(userId),
        this.statsRepo.hasReadLetter(userId),
      ],
    );

    const props = profile.toProps();
    return {
      id: props.id,
      nickname: props.nickname,
      avatarUrl: props.avatarUrl,
      onboardingCompleted: props.onboardingCompleted,
      hasPickled,
      hasLinkedQuestion,
      hasQuestion,
      hasEntry,
      hasReadLetter,
    };
  }
}
