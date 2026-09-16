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
  /**
   * 最後に運営者へテスト配信した時刻。本番配信とは独立で、何度でも更新される。
   * null = まだ一度もテストしていない。
   */
  testSentAt: string | null;
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
  | { kind: 'not-sendable'; message: string }
  | { kind: 'not-tested'; message: string };

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
  readonly testSentAt: string | null;
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
    this.testSentAt = props.testSentAt;
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
        testSentAt: null,
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

    // 本文を変えたら、前のテスト配信は「いま送られるもの」を確かめていない。
    // 印を残すと、別の文面を確認しただけでゲートが通ってしまう。
    const changed =
      content.subject.trim() !== this.subject || content.bodyMarkdown !== this.bodyMarkdown;

    return ok(
      new Newsletter({
        ...this.toProps(),
        subject: content.subject.trim(),
        bodyMarkdown: content.bodyMarkdown,
        testSentAt: changed ? null : this.testSentAt,
        updatedAt: now().toISOString(),
      }),
    );
  }

  /**
   * 送信開始。
   *
   * 3 つの条件を満たさないと始めない:
   *
   * - まだ送信していない（sent / sending を弾く = 二重送信の防波堤）
   * - **テスト配信済み**。本番配信は取り消せないので、実際に届く形を一度は
   *   目で見てからにする。本文を変えると印は消える（`withContent`）ので、
   *   「テストしたあと書き換えて送る」も塞がる
   * - 宛先が 1 名以上。「送ったつもりで誰にも届いていない」配信が sent として
   *   履歴に残るのを防ぐ
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
    if (this.testSentAt === null) {
      return err({
        kind: 'not-tested',
        message: 'まだテスト配信していません。先に運営者へ送って受信確認してください',
      });
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

  /**
   * 運営者へのテスト配信を記録する。
   *
   * **status は動かさない。** テスト配信は配信ではないので、これを sent にすると
   * 本番配信ができなくなる。逆に、テストしたことを残さないと「送ったつもりで
   * 本番を撃つ」経路ができる。
   */
  withTestSent(now: () => Date = () => new Date()): Newsletter {
    const timestamp = now().toISOString();
    return new Newsletter({
      ...this.toProps(),
      testSentAt: timestamp,
      updatedAt: timestamp,
    });
  }

  /**
   * テスト配信の確認をやり直させる。
   *
   * 翻訳を作り直したときに使う。**翻訳は「実際に届くもの」を変える。**
   * 日本語だけ確認した状態で英訳を足し、そのまま送れてしまうと、英語話者に
   * 何が届くのか誰も見ていないことになる。本文を書き換えたとき
   * （`withContent`）と同じ理由で印を落とす。
   */
  withTestInvalidated(now: () => Date = () => new Date()): Newsletter {
    if (this.testSentAt === null) return this;
    return new Newsletter({
      ...this.toProps(),
      testSentAt: null,
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
      testSentAt: this.testSentAt,
      sentAt: this.sentAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
