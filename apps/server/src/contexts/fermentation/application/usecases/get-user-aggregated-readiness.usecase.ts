import type { EntryRepositoryGateway } from '../../../entry/domain/gateways/entry-repository.gateway.js';
import type { EntryQuestionLinkRepositoryGateway } from '../../../question/domain/gateways/entry-question-link-repository.gateway.js';
import type { QuestionRepositoryGateway } from '../../../question/domain/gateways/question-repository.gateway.js';
import type { FermentationRepositoryGateway } from '../../domain/gateways/fermentation-repository.gateway.js';
import type { UserFermentationStateRepositoryGateway } from '../../domain/gateways/user-fermentation-state-repository.gateway.js';
import type { UserLocaleResolverGateway } from '../../domain/gateways/user-locale-resolver.gateway.js';
import {
  evaluateQuestionEligibility,
  type FermentationLanguage,
} from '../../domain/services/fermentation-eligibility.service.js';

// issue #278: client 用「発酵瓶 readiness」。
//
// PR #291 で readiness 計算は問い単位 (evaluateQuestionEligibility) に再設計された。
// 本 usecase はユーザーが現在持っている active な問いそれぞれの readiness を計算し、
// それらの合計を発酵瓶全体の readiness として返す。問い上限は 3 なので合計は [0, 3] に収まる
// (UI 側で「1.0 でかなり熟成 / 2.0 で活性化 / 3.0 で激しく泡立つ」と段階表現する想定)。
//
// admin 用の GetFermentationReadinessUsecase はユーザー単位の単一スコア (旧仕様) を返すので
// 別物。next_eligible_at は意図的に外部に露出しない (issue 受け入れ基準)。
interface AggregatedReadiness {
  totalReadiness: number; // [0, 3] — 問い数 × 1.0 が上限
  questionCount: number;
  language: FermentationLanguage;
}

export class GetUserAggregatedReadinessUsecase {
  constructor(
    private questionRepo: QuestionRepositoryGateway,
    private entryQuestionLinkRepo: EntryQuestionLinkRepositoryGateway,
    private entryRepo: EntryRepositoryGateway,
    private fermentationRepo: FermentationRepositoryGateway,
    private userStateRepo: UserFermentationStateRepositoryGateway,
    private localeResolver: UserLocaleResolverGateway,
  ) {}

  async execute(userId: string, now: Date = new Date()): Promise<AggregatedReadiness> {
    const [language, state, questions] = await Promise.all([
      this.localeResolver.resolve(userId),
      this.userStateRepo.findByUserId(userId),
      this.questionRepo.listActiveByUserId(userId),
    ]);

    if (questions.length === 0) {
      return { totalReadiness: 0, questionCount: 0, language };
    }

    const nextRandomHours = state?.nextRandomHours ?? null;

    const perQuestion = await Promise.all(
      questions.map(async (q) => {
        const [entryIds, fermentations] = await Promise.all([
          this.entryQuestionLinkRepo.listEntryIdsByQuestionId(q.id),
          this.fermentationRepo.listByQuestionId(q.id),
        ]);

        const lastRunAt =
          fermentations
            .filter((f) => f.status === 'completed')
            .map((f) => f.createdAt)
            .sort()
            .at(-1) ?? null;

        const entries = entryIds.length > 0 ? await this.entryRepo.findByIds(entryIds) : [];
        const cutoffMs = lastRunAt ? new Date(lastRunAt).getTime() : null;
        const charsSinceLastRun = entries.reduce((sum, entry) => {
          if (cutoffMs !== null && new Date(entry.createdAt).getTime() <= cutoffMs) return sum;
          return sum + [...entry.content].length;
        }, 0);

        const readiness = evaluateQuestionEligibility({
          lastRunAt,
          charsSinceLastRun,
          nextRandomHours,
          language,
          now,
        });
        return readiness.readinessScore;
      }),
    );

    const totalReadiness = perQuestion.reduce((sum, score) => sum + score, 0);
    return { totalReadiness, questionCount: questions.length, language };
  }
}
