import type { EntryRepositoryGateway } from '../../../entry/domain/gateways/entry-repository.gateway.js';
import type { Entry } from '../../../entry/domain/models/entry.js';
import type { EntryQuestionLinkRepositoryGateway } from '../../../question/domain/gateways/entry-question-link-repository.gateway.js';
import type { QuestionRepositoryGateway } from '../../../question/domain/gateways/question-repository.gateway.js';
import type { FermentationRepositoryGateway } from '../../domain/gateways/fermentation-repository.gateway.js';
import type { FermentationLanguage } from '../../domain/services/fermentation-eligibility.service.js';
import type { FireFermentationUsecase } from './fire-fermentation.usecase.js';

type FireFirstLetterResult =
  | {
      fired: false;
      /**
       * not-first: 既に発酵の行がある（状態は問わない）。初回だけの特例なので何もしない。
       * nothing-to-ferment: 漬けたエントリが無い、または active な問いに結ばれていない。
       */
      reason: 'not-first' | 'nothing-to-ferment';
    }
  | { fired: true; fermentationResultId: string; questionId: string };

/**
 * 初めての漬け込みには、その場で手紙を返す。
 *
 * 発酵は本来、夜間の cron が文字数と時間のゲートを見て発火する（scheduled-fermentation）。
 * 初めての人はそのゲートを越えるまで何も届かず、「漬けたのに何も起きない」で終わる。
 * そこで **一度も発酵の行が無いユーザーに限り**、いちばん最近漬けたエントリが結ばれた
 * 問いへ、ゲートを飛ばして 1 通だけ発火する。
 *
 * - 実際の発火は admin の強制発火（FireFermentationUsecase）に委ねる。同じくゲートを
 *   バイパスし、user_fermentation_state（lastRunAt / nextEligibleAt）は更新しない
 *   — 以後の定期発酵はこの 1 通が無かったものとして動く。
 * - 対象は「その問いに結ばれたエントリ全部」（FireFermentation の範囲そのまま）。初めての
 *   人は通常 1 通しか持たないので実質いま漬けたものになる。
 * - メール（digest）は送らない。呼び出し元の画面にすぐ出るので、通知の意味が無い。
 * - 2 回目以降（既に行がある）は何もしない。呼ぶ側はこれに頼ってよい（漬けるたびに
 *   呼んで構わない）。
 */
export class FireFirstLetterUsecase {
  constructor(
    private entryRepo: EntryRepositoryGateway,
    private questionRepo: QuestionRepositoryGateway,
    private entryQuestionLinkRepo: EntryQuestionLinkRepositoryGateway,
    private fermentationRepo: FermentationRepositoryGateway,
    private fireFermentation: Pick<FireFermentationUsecase, 'execute'>,
  ) {}

  async execute(params: {
    userId: string;
    language?: FermentationLanguage;
  }): Promise<FireFirstLetterResult> {
    // 1. 初回か。状態を問わず行が 1 つでもあれば初回ではない（failed も数える —
    //    失敗した行は cron のリトライ (#353) が拾うので、ここで二重に発火しない）。
    const existing = await this.fermentationRepo.listByUserId(params.userId);
    if (existing.length > 0) return { fired: false, reason: 'not-first' };

    // 2. いちばん最近漬けたエントリ。漬け込みは updated_at を進めるので、それが新しい順。
    const pickled = await this.entryRepo.listFermentationEnabledByUserIdSince(params.userId, null);
    const latest = newestUpdated(pickled);
    if (!latest) return { fired: false, reason: 'nothing-to-ferment' };

    // 3. そのエントリが結ばれた active な問い。複数あれば active 一覧の先頭（作成順）。
    const linkedQuestionIds = new Set(
      await this.entryQuestionLinkRepo.listQuestionIdsByEntryId(latest.toProps().id),
    );
    const activeQuestions = await this.questionRepo.listActiveByUserId(params.userId);
    const question = activeQuestions.find((q) => linkedQuestionIds.has(q.id));
    if (!question) return { fired: false, reason: 'nothing-to-ferment' };

    // 4. 発火（ゲートを飛ばす。state は触らない）。
    const { fired } = await this.fireFermentation.execute({
      userId: params.userId,
      questionId: question.id,
      language: params.language,
    });
    const item = fired[0];
    if (!item) return { fired: false, reason: 'nothing-to-ferment' };

    return {
      fired: true,
      fermentationResultId: item.fermentationResultId,
      questionId: item.questionId,
    };
  }
}

/** updatedAt がいちばん新しいもの。同時刻なら後ろ（作成が新しい側）。 */
function newestUpdated(entries: Entry[]): Entry | null {
  let best: Entry | null = null;
  for (const entry of entries) {
    if (!best || entry.toProps().updatedAt >= best.toProps().updatedAt) best = entry;
  }
  return best;
}
