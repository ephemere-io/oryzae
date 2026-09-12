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
