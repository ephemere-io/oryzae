import type { EntryRepositoryGateway } from '../../../entry/domain/gateways/entry-repository.gateway.js';
import type { QuestionRepositoryGateway } from '../../../question/domain/gateways/question-repository.gateway.js';
import type { FermentationRepositoryGateway } from '../../domain/gateways/fermentation-repository.gateway.js';
import type { UserFermentationStateRepositoryGateway } from '../../domain/gateways/user-fermentation-state-repository.gateway.js';
import type { UserLocaleResolverGateway } from '../../domain/gateways/user-locale-resolver.gateway.js';
import { evaluateQuestionEligibility } from '../../domain/services/fermentation-eligibility.service.js';

// 発酵瓶の readiness (issue #278)。
//
// #268 の時点では readiness はユーザー単位だったが、#287 (PR #291) で
// 「問い単位の readiness」に作り替えた。瓶は問いを最大3つ抱えるので、
//   瓶の readiness = その人が持っているアクティブな問いの readiness の総和
// と捉える。1問いあたり上限 1.0 なので、総和の上限は問いの数 (現状は最大 3.0)。
//
// **返すのは総和と問いの数だけ**。lastRunAt / nextEligibleAt / 文字数の内訳は
// client には返さない。「いつ来るか分からない」ことがこのプロダクトの体験の芯で、
// 残り時間や残り文字数が分かると逆算できてしまう (issue #278「3. UX の補強」)。
// admin 側 (GET /admin/fermentations/readiness/:userId) は従来どおり全部返す。
export interface JarReadiness {
  /** アクティブな問いの readiness の総和。0 〜 questionCount。 */
  score: number;
  /** 総和の分母にあたるアクティブな問いの数。 */
  questionCount: number;
}

export class GetJarReadinessUsecase {
  constructor(
    private questionRepo: QuestionRepositoryGateway,
    private entryRepo: EntryRepositoryGateway,
    private fermentationRepo: FermentationRepositoryGateway,
    private userStateRepo: UserFermentationStateRepositoryGateway,
    private localeResolver: UserLocaleResolverGateway,
  ) {}

  async execute(userId: string, now: Date = new Date()): Promise<JarReadiness> {
    const questions = await this.questionRepo.listActiveByUserId(userId);
    if (questions.length === 0) return { score: 0, questionCount: 0 };

    const [language, state, results] = await Promise.all([
      this.localeResolver.resolve(userId),
      this.userStateRepo.findByUserId(userId),
      this.fermentationRepo.listByUserId(userId),
    ]);

    // 問いごとの「直近の成功発酵時刻」。この時刻以降に書かれた文字だけが次の発酵の材料になる。
    const lastRunAtByQuestion = new Map<string, string>();
    for (const result of results) {
      if (result.status !== 'completed') continue;
      const current = lastRunAtByQuestion.get(result.questionId);
      if (!current || result.createdAt > current) {
        lastRunAtByQuestion.set(result.questionId, result.createdAt);
      }
    }

    // nextRandomHours は問い単位では持っていないので、ユーザー単位の値を全問いに使う
    // (evaluateQuestionEligibility と同じ前提。admin-questions.ts も同様)。
    const nextRandomHours = state?.nextRandomHours ?? null;

    const scores = await Promise.all(
      questions.map(async (question) => {
        const lastRunAt = lastRunAtByQuestion.get(question.id) ?? null;
        const charsSinceLastRun = await this.entryRepo.countCharsByQuestionIdSince(
          userId,
          question.id,
          lastRunAt,
        );
        return evaluateQuestionEligibility({
          lastRunAt,
          charsSinceLastRun,
          nextRandomHours,
          language,
          now,
        }).readinessScore;
      }),
    );

    const total = scores.reduce((sum, score) => sum + score, 0);
    // 浮動小数の端数をそのまま JSON に載せない (0.30000000000000004 のような値を防ぐ)。
    return { score: Math.round(total * 100) / 100, questionCount: questions.length };
  }
}
