import { err, ok, type Result } from '../../../shared/domain/types/result.js';

/**
 * 配信の状態。
 *
 * `sending` は二重送信を防ぐための中間状態。送信は数百通の HTTP を伴って
 * 数秒かかるので、その間に 2 回目の /send が来る可能性が現実にある。
 * 「送信済みかどうか」だけで判定すると、1 回目が終わる前の 2 回目が通って
 * 全員に 2 通届く。状態遷移で塞ぐ。
 */
export type NewsletterStatus = 'draft' | 'sending' | 'sent';

export const NEWSLETTER_STATUSES: readonly NewsletterStatus[] = ['draft', 'sending', 'sent'];

/** 件名の上限。メールクライアントが省略し始める長さより少し余裕を持たせた値。 */
export const MAX_NEWSLETTER_SUBJECT_LENGTH = 120;
/** 本文の上限。お知らせメールとして現実的な長さの上限。 */
export const MAX_NEWSLETTER_BODY_LENGTH = 20_000;

export interface NewsletterProps {
  id: string;
  subject: string;
  bodyMarkdown: string;
  status: NewsletterStatus;
  /** 書いた admin の user_id。削除済みなら null。 */
  createdBy: string | null;
  /** 送信開始時点で数えた宛先数。draft の間は 0。 */
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  /** 送信が落ちたときの理由。次の送信開始でクリアする。 */
  lastError: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type NewsletterIssue =
  | { kind: 'subject-empty'; message: string }
  | { kind: 'subject-too-long'; message: string }
  | { kind: 'body-empty'; message: string }
  | { kind: 'body-too-long'; message: string }
  | { kind: 'not-editable'; message: string }
  | { kind: 'not-sendable'; message: string };

interface NewsletterContent {
  subject: string;
  bodyMarkdown: string;
}

function validateContent(content: NewsletterContent): NewsletterIssue | null {
  const subject = content.subject.trim();
  if (subject.length === 0) {
    return { kind: 'subject-empty', message: '件名が空です' };
  }
  if (subject.length > MAX_NEWSLETTER_SUBJECT_LENGTH) {
    return {
      kind: 'subject-too-long',
      message: `件名は ${MAX_NEWSLETTER_SUBJECT_LENGTH} 文字までです`,
    };
  }
  if (content.bodyMarkdown.trim().length === 0) {
    return { kind: 'body-empty', message: '本文が空です' };
  }
  if (content.bodyMarkdown.length > MAX_NEWSLETTER_BODY_LENGTH) {
    return {
      kind: 'body-too-long',
      message: `本文は ${MAX_NEWSLETTER_BODY_LENGTH} 文字までです`,
    };
  }
  return null;
}

export class Newsletter {
  readonly id: string;
  readonly subject: string;
  readonly bodyMarkdown: string;
  readonly status: NewsletterStatus;
  readonly createdBy: string | null;
  readonly recipientCount: number;
  readonly sentCount: number;
  readonly failedCount: number;
  readonly lastError: string | null;
  readonly sentAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;

  private constructor(props: NewsletterProps) {
    this.id = props.id;
    this.subject = props.subject;
    this.bodyMarkdown = props.bodyMarkdown;
    this.status = props.status;
    this.createdBy = props.createdBy;
    this.recipientCount = props.recipientCount;
    this.sentCount = props.sentCount;
    this.failedCount = props.failedCount;
    this.lastError = props.lastError;
    this.sentAt = props.sentAt;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  /**
   * 新規下書き。
   *
   * 下書きは「途中まで書いて保存する」ものなので、本文が空でも作れてよさそうに
   * 見えるが、空の下書きが並ぶと一覧が読めなくなる。件名だけは必須にし、本文は
   * 作成時から検証する（保存のたびに検証するのと揃える）。
   */
  static create(
    params: { subject: string; bodyMarkdown: string; createdBy: string | null },
    generateId: () => string,
    now: () => Date = () => new Date(),
  ): Result<Newsletter, NewsletterIssue> {
    const issue = validateContent(params);
    if (issue) return err(issue);

    const timestamp = now().toISOString();
    return ok(
      new Newsletter({
        id: generateId(),
        subject: params.subject.trim(),
        bodyMarkdown: params.bodyMarkdown,
        status: 'draft',
        createdBy: params.createdBy,
        recipientCount: 0,
        sentCount: 0,
        failedCount: 0,
        lastError: null,
        sentAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      }),
    );
  }

  static fromProps(props: NewsletterProps): Newsletter {
    return new Newsletter(props);
  }

  /** 送信済み / 送信中は編集も削除もできない（届いた文面と食い違うため）。 */
  get isEditable(): boolean {
    return this.status === 'draft';
  }

  withContent(
    content: NewsletterContent,
    now: () => Date = () => new Date(),
  ): Result<Newsletter, NewsletterIssue> {
    if (!this.isEditable) {
      return err({
        kind: 'not-editable',
        message: '送信済み（または送信中）の配信は編集できません',
      });
    }
    const issue = validateContent(content);
    if (issue) return err(issue);

    return ok(
      new Newsletter({
        ...this.toProps(),
        subject: content.subject.trim(),
        bodyMarkdown: content.bodyMarkdown,
        updatedAt: now().toISOString(),
      }),
    );
  }

  /**
   * 送信開始。宛先が 0 名のときは開始させない —— 「送ったつもりで誰にも
   * 届いていない」配信が sent として履歴に残るのを防ぐ。
   */
  withSendingStarted(
    recipientCount: number,
    now: () => Date = () => new Date(),
  ): Result<Newsletter, NewsletterIssue> {
    if (this.status === 'sent') {
      return err({ kind: 'not-sendable', message: 'この配信はすでに送信済みです' });
    }
    if (this.status === 'sending') {
      return err({ kind: 'not-sendable', message: 'この配信は送信中です' });
    }
    if (recipientCount <= 0) {
      return err({ kind: 'not-sendable', message: '宛先が 0 名です' });
    }
    return ok(
      new Newsletter({
        ...this.toProps(),
        status: 'sending',
        recipientCount,
        sentCount: 0,
        failedCount: 0,
        lastError: null,
        updatedAt: now().toISOString(),
      }),
    );
  }

  /**
   * 送信完了。全員に失敗しても sent にする（「送信を実行した」事実は変わらず、
   * 失敗数が残るほうが再送の判断材料になる）。
   */
  withSendCompleted(
    counts: { sentCount: number; failedCount: number },
    now: () => Date = () => new Date(),
  ): Newsletter {
    const timestamp = now().toISOString();
    return new Newsletter({
      ...this.toProps(),
      status: 'sent',
      sentCount: counts.sentCount,
      failedCount: counts.failedCount,
      sentAt: timestamp,
      updatedAt: timestamp,
    });
  }

  /**
   * 送信そのものが始められなかった / 途中で落ちた場合に draft へ戻す。
   * sending のまま固まると、以後この配信は永久に送れなくなる。
   */
  withSendAborted(error: string, now: () => Date = () => new Date()): Newsletter {
    return new Newsletter({
      ...this.toProps(),
      status: 'draft',
      lastError: error,
      updatedAt: now().toISOString(),
    });
  }

  toProps(): NewsletterProps {
    return {
      id: this.id,
      subject: this.subject,
      bodyMarkdown: this.bodyMarkdown,
      status: this.status,
      createdBy: this.createdBy,
      recipientCount: this.recipientCount,
      sentCount: this.sentCount,
      failedCount: this.failedCount,
      lastError: this.lastError,
      sentAt: this.sentAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
