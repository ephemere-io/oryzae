import type {
  EntryRepositoryGateway,
  MonthlyEntryCount,
} from '../../domain/gateways/entry-repository.gateway.js';

/**
 * 月ごとの記録件数を返す（書斎の手帳の厚みと、棚に並ぶ冊数を決める）。
 *
 * 既存の一覧をページングして数えると、書斎を開くたびに全件をクライアントへ運ぶことになる。
 * 数えるだけならサーバーで畳んで `{ month, count }` の配列にすれば済む。
 */
export class ListEntryMonthlyCountsUsecase {
  constructor(private entryRepo: EntryRepositoryGateway) {}

  async execute(userId: string, tzOffsetMinutes = 0): Promise<MonthlyEntryCount[]> {
    return this.entryRepo.countByMonth(userId, tzOffsetMinutes);
  }
}
