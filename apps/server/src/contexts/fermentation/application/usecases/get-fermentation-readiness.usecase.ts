import type { EntryRepositoryGateway } from '../../../entry/domain/gateways/entry-repository.gateway.js';
import type { UserFermentationStateRepositoryGateway } from '../../domain/gateways/user-fermentation-state-repository.gateway.js';
import type { UserLocaleResolverGateway } from '../../domain/gateways/user-locale-resolver.gateway.js';
import {
  type EligibilityResult,
  evaluateEligibility,
  type FermentationLanguage,
} from '../../domain/services/fermentation-eligibility.service.js';

// admin ダッシュボード表示用。指定ユーザーの「現時点の発火条件」を計算して返す。
// readinessScore は ScheduledFermentationUsecase が日次で DB に書く値だが、
// admin で確認するときは「今このタイミング」での評価を見たいので毎回計算する。
interface FermentationReadiness extends EligibilityResult {
  userId: string;
  language: FermentationLanguage;
  lastRunAt: string | null;
  nextEligibleAt: string | null;
  isFirstTime: boolean;
}

export class GetFermentationReadinessUsecase {
  constructor(
    private entryRepo: EntryRepositoryGateway,
    private userStateRepo: UserFermentationStateRepositoryGateway,
    private localeResolver: UserLocaleResolverGateway,
  ) {}

  async execute(userId: string, now: Date = new Date()): Promise<FermentationReadiness> {
    const language = await this.localeResolver.resolve(userId);
    const state = await this.userStateRepo.findByUserId(userId);
    const sinceIso = state?.lastRunAt ?? null;
    const totalChars = await this.entryRepo.countCharsByUserIdSince(userId, sinceIso);

    const evaluation = evaluateEligibility({ state, totalChars, language, now });
    return {
      ...evaluation,
      userId,
      language,
      lastRunAt: state?.lastRunAt ?? null,
      nextEligibleAt: state?.nextEligibleAt ?? null,
      isFirstTime: !state || state.lastRunAt === null,
    };
  }
}
