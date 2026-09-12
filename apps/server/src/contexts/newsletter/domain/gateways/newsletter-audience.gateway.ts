export interface NewsletterRecipient {
  userId: string;
  email: string;
}

/**
 * 一斉配信の宛先を数える / 列挙する。
 *
 * count と list を分けてあるのは呼び出し側の意図を型に出すため。確認画面は
 * 「何名か」しか要らず、アドレスを受け取る必要が無い（受け取らなければ
 * 画面へ漏らしようもない）。数え方そのものは実装側の都合で変わりうる。
 */
export interface NewsletterAudienceGateway {
  countRecipients(): Promise<number>;
  listRecipients(): Promise<NewsletterRecipient[]>;
}
