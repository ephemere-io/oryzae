import { describe, expect, it } from 'vitest';
import {
  MAX_NEWSLETTER_BODY_LENGTH,
  MAX_NEWSLETTER_SUBJECT_LENGTH,
  Newsletter,
} from '@/contexts/newsletter/domain/models/newsletter.js';

const generateId = () => 'nl-1';
const at = (iso: string) => () => new Date(iso);

function draft(overrides?: { subject?: string; bodyMarkdown?: string }) {
  const result = Newsletter.create(
    {
      subject: overrides?.subject ?? '今月の更新',
      bodyMarkdown: overrides?.bodyMarkdown ?? '本文です。',
      createdBy: 'admin-1',
    },
    generateId,
    at('2026-09-01T00:00:00.000Z'),
  );
  if (!result.success) throw new Error(`expected a draft, got ${result.error.kind}`);
  return result.value;
}

describe('Newsletter.create', () => {
  it('下書きとして作られる（送信に関わる値は 0 / null）', () => {
    const newsletter = draft();

    expect(newsletter.id).toBe('nl-1');
    expect(newsletter.status).toBe('draft');
    expect(newsletter.isEditable).toBe(true);
    expect(newsletter.recipientCount).toBe(0);
    expect(newsletter.sentCount).toBe(0);
    expect(newsletter.failedCount).toBe(0);
    expect(newsletter.sentAt).toBeNull();
    expect(newsletter.lastError).toBeNull();
    expect(newsletter.createdAt).toBe('2026-09-01T00:00:00.000Z');
  });

  it('件名の前後の空白は落とす（一覧の見た目が揃わなくなるため）', () => {
    expect(draft({ subject: '  今月の更新  ' }).subject).toBe('今月の更新');
  });

  it('空の件名・空白だけの件名を弾く', () => {
    for (const subject of ['', '   ', '\n']) {
      const result = Newsletter.create(
        { subject, bodyMarkdown: '本文', createdBy: null },
        generateId,
      );
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.kind).toBe('subject-empty');
    }
  });

  it('空の本文を弾く', () => {
    const result = Newsletter.create(
      { subject: '件名', bodyMarkdown: '   \n  ', createdBy: null },
      generateId,
    );
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.kind).toBe('body-empty');
  });

  it('上限ちょうどは通し、1 文字超えたら弾く（件名）', () => {
    const exact = 'あ'.repeat(MAX_NEWSLETTER_SUBJECT_LENGTH);
    expect(
      Newsletter.create({ subject: exact, bodyMarkdown: '本文', createdBy: null }, generateId)
        .success,
    ).toBe(true);

    const over = Newsletter.create(
      { subject: `${exact}あ`, bodyMarkdown: '本文', createdBy: null },
      generateId,
    );
    expect(over.success).toBe(false);
    if (!over.success) expect(over.error.kind).toBe('subject-too-long');
  });

  it('上限を超えた本文を弾く', () => {
    const over = Newsletter.create(
      {
        subject: '件名',
        bodyMarkdown: 'あ'.repeat(MAX_NEWSLETTER_BODY_LENGTH + 1),
        createdBy: null,
      },
      generateId,
    );
    expect(over.success).toBe(false);
    if (!over.success) expect(over.error.kind).toBe('body-too-long');
  });
});

describe('Newsletter.withContent', () => {
  it('下書きなら書き換えられ、updatedAt が進む', () => {
    const updated = draft().withContent(
      { subject: '差し替え', bodyMarkdown: '新しい本文' },
      at('2026-09-02T00:00:00.000Z'),
    );

    expect(updated.success).toBe(true);
    if (!updated.success) return;
    expect(updated.value.subject).toBe('差し替え');
    expect(updated.value.bodyMarkdown).toBe('新しい本文');
    expect(updated.value.updatedAt).toBe('2026-09-02T00:00:00.000Z');
    expect(updated.value.createdAt).toBe('2026-09-01T00:00:00.000Z');
  });

  it('送信中・送信済みは編集できない（届いた文面と食い違うため）', () => {
    const sending = draft().withSendingStarted(3);
    expect(sending.success).toBe(true);
    if (!sending.success) return;

    const whileSending = sending.value.withContent({ subject: 'x', bodyMarkdown: 'y' });
    expect(whileSending.success).toBe(false);
    if (!whileSending.success) expect(whileSending.error.kind).toBe('not-editable');

    const sent = sending.value.withSendCompleted({ sentCount: 3, failedCount: 0 });
    expect(sent.isEditable).toBe(false);
    const afterSent = sent.withContent({ subject: 'x', bodyMarkdown: 'y' });
    expect(afterSent.success).toBe(false);
    if (!afterSent.success) expect(afterSent.error.kind).toBe('not-editable');
  });
});

describe('Newsletter.withSendingStarted', () => {
  it('宛先数を記録して sending にする', () => {
    const started = draft().withSendingStarted(42, at('2026-09-03T00:00:00.000Z'));

    expect(started.success).toBe(true);
    if (!started.success) return;
    expect(started.value.status).toBe('sending');
    expect(started.value.recipientCount).toBe(42);
    expect(started.value.updatedAt).toBe('2026-09-03T00:00:00.000Z');
  });

  it('宛先 0 名では始めない（誰にも届いていない配信が sent で残るため）', () => {
    const result = draft().withSendingStarted(0);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.kind).toBe('not-sendable');
  });

  it('送信中の再送信を弾く（二重送信の防波堤）', () => {
    const started = draft().withSendingStarted(3);
    expect(started.success).toBe(true);
    if (!started.success) return;

    const again = started.value.withSendingStarted(3);
    expect(again.success).toBe(false);
    if (!again.success) expect(again.error.message).toContain('送信中');
  });

  it('送信済みの再送信を弾く', () => {
    const started = draft().withSendingStarted(3);
    if (!started.success) throw new Error('unreachable');
    const sent = started.value.withSendCompleted({ sentCount: 3, failedCount: 0 });

    const again = sent.withSendingStarted(3);
    expect(again.success).toBe(false);
    if (!again.success) expect(again.error.message).toContain('送信済み');
  });

  it('直前の失敗理由は送信開始でクリアされる', () => {
    const aborted = draft().withSendAborted('前回の失敗');
    expect(aborted.lastError).toBe('前回の失敗');

    const restarted = aborted.withSendingStarted(1);
    expect(restarted.success).toBe(true);
    if (restarted.success) expect(restarted.value.lastError).toBeNull();
  });
});

describe('Newsletter.withSendCompleted / withSendAborted', () => {
  it('送信結果を記録して sent にする（sentAt が入る）', () => {
    const started = draft().withSendingStarted(10);
    if (!started.success) throw new Error('unreachable');

    const completed = started.value.withSendCompleted(
      { sentCount: 8, failedCount: 2 },
      at('2026-09-04T12:00:00.000Z'),
    );

    expect(completed.status).toBe('sent');
    expect(completed.sentCount).toBe(8);
    expect(completed.failedCount).toBe(2);
    expect(completed.sentAt).toBe('2026-09-04T12:00:00.000Z');
  });

  it('全員失敗しても sent にする（実行した事実は残す）', () => {
    const started = draft().withSendingStarted(5);
    if (!started.success) throw new Error('unreachable');

    const completed = started.value.withSendCompleted({ sentCount: 0, failedCount: 5 });
    expect(completed.status).toBe('sent');
    expect(completed.failedCount).toBe(5);
  });

  it('中断すると draft に戻る（sending のまま固まると二度と送れない）', () => {
    const started = draft().withSendingStarted(5);
    if (!started.success) throw new Error('unreachable');

    const aborted = started.value.withSendAborted('Resend API 500');

    expect(aborted.status).toBe('draft');
    expect(aborted.isEditable).toBe(true);
    expect(aborted.lastError).toBe('Resend API 500');
    expect(aborted.sentAt).toBeNull();
  });
});
