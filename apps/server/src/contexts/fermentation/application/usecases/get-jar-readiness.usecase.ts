import type { EntryRepositoryGateway } from '../../../entry/domain/gateways/entry-repository.gateway.js';
import type { QuestionRepositoryGateway } from '../../../question/domain/gateways/question-repository.gateway.js';
import type { FermentationRepositoryGateway } from '../../domain/gateways/fermentation-repository.gateway.js';
import type { UserFermentationStateRepositoryGateway } from '../../domain/gateways/user-fermentation-state-repository.gateway.js';
import type { UserLocaleResolverGateway } from '../../domain/gateways/user-locale-resolver.gateway.js';
import { evaluateQuestionEligibility } from '../../domain/services/fermentation-eligibility.service.js';

// 発酵瓶の readiness (issue #278)。
//
// #268 の時点では readiness はユーザー単位だったが、#287 (PR #291) で
// 「問い単位の readiness」に作り替えた。瓶はそれを2つの軸に畳んで受け取る。
//
//   top   = いちばん進んだ問いの readiness (0〜1)
//   total = 全問いの readiness の総和 (0〜問いの数)
//
// 当初は total だけを返し、演出の段階を 1.0/2.0/3.0 で切っていた。しかしそれだと
// **問いを1つしか持たない人は上限 1.0 で、泡立ちに一生到達しない**。issue の
// 「総和」という記述どおりではあったが、意図ではなかった (PR #559 でのレビュー)。
//
// そこで役割を分けた:
//   - 「何が起きるか」(段階) は top が決める → 問い1つでも最後まで到達できる
//   - 「どれだけ賑やかか」(密度) は total が決める → 同時に多く発酵させている人ほど濃い
// 畳み方の正は client 側の jar-visuals.ts。ここは素材を返すだけに徹する。
//
// **返すのはこの2つと問いの数だけ**。lastRunAt / nextEligibleAt / 文字数の内訳は
// client には返さない。「いつ来るか分からない」ことがこのプロダクトの体験の芯で、
// 残り時間や残り文字数が分かると逆算できてしまう (issue #278「3. UX の補強」)。
// admin 側 (GET /admin/fermentations/readiness/:userId) は従来どおり全部返す。
export interface JarReadiness {
  /** いちばん進んだ問いの readiness。0〜1。演出の段階を決める。 */
  top: number;
  /** アクティブな問いの readiness の総和。0 〜 questionCount。密度を決める。 */
  total: number;
  /** アクティブな問いの数。 */
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
    if (questions.length === 0) return { top: 0, total: 0, questionCount: 0 };

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
    const top = scores.reduce((max, score) => (score > max ? score : max), 0);
    // 浮動小数の端数をそのまま JSON に載せない (0.30000000000000004 のような値を防ぐ)。
    return {
      top: round2(top),
      total: round2(total),
      questionCount: questions.length,
    };
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
