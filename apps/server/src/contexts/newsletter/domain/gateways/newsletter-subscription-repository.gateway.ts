export interface NewsletterSubscriptionRepositoryGateway {
  /**
   * 配信停止フラグを立てる / 下ろす。
   *
   * 対象が存在しなければ false（呼び出し側が 404 に倒す）。「押したのに
   * 何も起きなかった」を成功として返さないため、見つかったかどうかを返す。
   */
  setOptOut(userId: string, optOut: boolean): Promise<boolean>;
}
