import type { FermentationRepositoryGateway } from '../../domain/gateways/fermentation-repository.gateway.js';

interface MarkLettersReadResult {
  /** 今回はじめて既読になった行数。既読済みばかりなら 0。 */
  marked: number;
}

/**
 * 手紙を読んだことをサーバに残す（POST /api/v1/fermentations/read）。
 *
 * 単位は問い。client の受信箱が問いごとに最新 1 通しか出さないので、既読の単位も
 * 問いに揃える（use-unread-letters.ts と同じ判断）。その問いの完了した発酵のうち
 * まだ read_at が空のものに今の時刻を書く。既読済みの行は触らないので、何度呼んでも
 * 結果は変わらない（冪等）。
 *
 * ヘルプの五歩 ⑤「手紙を読む」は、この列が埋まっているかで判定する
 * （user コンテキストの `hasReadLetter`）。
 */
export class MarkLettersReadUsecase {
  constructor(
    private fermentationRepo: FermentationRepositoryGateway,
    // テストで時刻を固定できるように注入する。
    private now: () => Date = () => new Date(),
  ) {}

  async execute(params: { userId: string; questionId: string }): Promise<MarkLettersReadResult> {
    const marked = await this.fermentationRepo.markReadByQuestionId(
      params.userId,
      params.questionId,
      this.now().toISOString(),
    );
    return { marked };
  }
}
