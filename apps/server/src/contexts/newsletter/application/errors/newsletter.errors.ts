import {
  NotFoundError,
  ValidationError,
} from '../../../shared/application/errors/application.errors.js';

export class NewsletterNotFoundError extends NotFoundError {
  constructor(newsletterId: string) {
    super(`Newsletter not found: ${newsletterId}`);
  }
}

/** domain の `NewsletterIssue` を HTTP 400 に変換する口。 */
export class NewsletterValidationError extends ValidationError {}

/**
 * 「素材が無いので下書きを作れない」。
 *
 * LLM に空の PR 一覧を渡すと、それらしい嘘のリリースノートを書いてしまう。
 * 何も変わっていないなら、作らずにそう言う。
 */
export class NewsletterNoChangesError extends ValidationError {
  constructor(since: string | null) {
    super(
      since
        ? `前回配信 (${since}) 以降にマージされた PR がありません`
        : 'マージ済みの PR が見つかりませんでした',
    );
  }
}

/** GitHub / LLM など外部が使えない状態。設定漏れを含む。 */
export class NewsletterChangelogUnavailableError extends ValidationError {}

/**
 * 配信停止リンクのトークンが不正、または対象の利用者がもういない。
 *
 * 両方を同じエラーにしているのは、応答の差から実在する user_id を
 * 探れないようにするため（公開エンドポイント）。
 */
export class NewsletterInvalidUnsubscribeTokenError extends ValidationError {
  constructor() {
    super('このリンクは無効です。お手数ですが設定画面から変更してください。');
  }
}

/**
 * その言語の翻訳が無い / 原文より古いため送信できない。
 *
 * 原文にフォールバックしない理由: 「英語のつもりが日本語で届いた」が黙って
 * 起きるより、送る前に止まったほうがよい。
 */
export class NewsletterTranslationMissingError extends ValidationError {
  constructor(locale: string) {
    super(
      `${locale} の翻訳がないか、原文より古くなっています。翻訳を作成してから送信してください。`,
    );
  }
}

/**
 * 配信停止リンクを作れない（署名鍵が無い）ため送信できない。
 *
 * 止める口の無い一斉配信は、受け取った人に迷惑メール報告以外の選択肢を
 * 残さない。送る前に落とす。
 */
export class NewsletterUnsubscribeUnavailableError extends ValidationError {}
