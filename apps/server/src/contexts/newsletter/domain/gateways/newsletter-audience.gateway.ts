import type { NewsletterLocale } from '../models/newsletter-locale.js';

export interface NewsletterRecipient {
  userId: string;
  email: string;
  /**
   * その人が Oryzae を使っている言語（`user_metadata.locale`）。
   * 未設定・想定外の値は原文の言語に倒す（`resolveNewsletterLocale`）。
   */
  locale: NewsletterLocale;
}

/** 言語ごとの宛先数。0 の言語も含む（画面で「0 名」と出したいため）。 */
export type RecipientCountByLocale = Record<NewsletterLocale, number>;

/**
 * 一斉配信の宛先を数える / 列挙する。
 *
 * count と list を分けてあるのは呼び出し側の意図を型に出すため。確認画面は
 * 「何名か」しか要らず、アドレスを受け取る必要が無い（受け取らなければ
 * 画面へ漏らしようもない）。数え方そのものは実装側の都合で変わりうる。
 */
export interface NewsletterAudienceGateway {
  /**
   * 言語ごとの宛先数。
   *
   * 合計だけでなく内訳を返すのは、確認画面が「英語 7 名へ翻訳版が届く」ことを
   * 出す必要があるため。合計しか無いと、翻訳が必要かどうかを画面が判断できない。
   */
  countRecipientsByLocale(): Promise<RecipientCountByLocale>;
  listRecipients(): Promise<NewsletterRecipient[]>;
  /**
   * テスト配信の宛先（運営者だけ）。
   *
   * 本番配信の前に自分たちへ送って受信確認するための口。**本番の宛先とは
   * 別のメソッドにしてある** —— 同じメソッドに引数で分岐を足すと、引数を
   * 1 つ間違えただけで全員に飛ぶ。型で分けておけば取り違えようがない。
   *
   * 配信停止 (`newsletter_opt_out`) は無視する。テスト配信は運営が自分の
   * 意思で撃つもので、購読の話ではない。
   */
  listTestRecipients(): Promise<NewsletterRecipient[]>;
}
