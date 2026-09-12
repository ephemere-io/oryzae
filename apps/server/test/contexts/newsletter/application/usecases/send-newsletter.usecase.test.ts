import { describe, expect, it, vi } from 'vitest';
import { SendNewsletterUsecase } from '@/contexts/newsletter/application/usecases/send-newsletter.usecase.js';
import type { BulkEmailSenderGateway } from '@/contexts/newsletter/domain/gateways/bulk-email-sender.gateway.js';
import type {
  NewsletterAudienceGateway,
  NewsletterRecipient,
} from '@/contexts/newsletter/domain/gateways/newsletter-audience.gateway.js';
import type { NewsletterRepositoryGateway } from '@/contexts/newsletter/domain/gateways/newsletter-repository.gateway.js';
import { Newsletter } from '@/contexts/newsletter/domain/models/newsletter.js';

function draft(): Newsletter {
  const result = Newsletter.create(
    { subject: '今月の更新', bodyMarkdown: '本文です。', createdBy: 'admin-1' },
    () => 'nl-1',
  );
  if (!result.success) throw new Error('unreachable');
  return result.value;
}

/** save() された Newsletter を順に記録するリポジトリ。状態遷移を検証するため。 */
function mockRepository(initial: Newsletter | null) {
  const saved: Newsletter[] = [];
  const repository: NewsletterRepositoryGateway = {
    findById: vi.fn().mockResolvedValue(initial),
    listRecent: vi.fn().mockResolvedValue([]),
    findLastSent: vi.fn().mockResolvedValue(null),
    save: vi.fn(async (newsletter: Newsletter) => {
      saved.push(newsletter);
    }),
    delete: vi.fn(),
  };
  return { repository, saved };
}

function mockAudience(recipients: NewsletterRecipient[]): NewsletterAudienceGateway {
  return {
    countRecipients: vi.fn().mockResolvedValue(recipients.length),
    listRecipients: vi.fn().mockResolvedValue(recipients),
  };
}

const recipients: NewsletterRecipient[] = [
  { userId: 'u1', email: 'a@example.com' },
  { userId: 'u2', email: 'b@example.com' },
];

describe('SendNewsletterUsecase', () => {
  it('宛先ごとに 1 通ずつ組み立てて送る（BCC でまとめない）', async () => {
    const { repository } = mockRepository(draft());
    const sender: BulkEmailSenderGateway = {
      sendBulk: vi.fn().mockResolvedValue({ sent: true, delivered: 2, failures: [] }),
    };
    const usecase = new SendNewsletterUsecase(repository, mockAudience(recipients), sender);

    const result = await usecase.execute('nl-1');

    expect(result.sent).toBe(true);
    expect(result.delivered).toBe(2);
    expect(result.failed).toBe(0);

    const messages = vi.mocked(sender.sendBulk).mock.calls[0][0];
    expect(messages).toHaveLength(2);
    expect(messages.map((m) => m.to)).toEqual(['a@example.com', 'b@example.com']);
    // 全員に同じ本文。件名は配信の件名そのまま。
    expect(new Set(messages.map((m) => m.html)).size).toBe(1);
    expect(messages[0].subject).toBe('今月の更新');
    expect(messages[0].html).toContain('本文です。');
    expect(messages[0].text).toContain('本文です。');
  });

  it('送信前に sending で保存し、完了後に sent で保存する（二重送信の防波堤）', async () => {
    const { repository, saved } = mockRepository(draft());
    const sender: BulkEmailSenderGateway = {
      sendBulk: vi.fn().mockResolvedValue({ sent: true, delivered: 2, failures: [] }),
    };
    const usecase = new SendNewsletterUsecase(repository, mockAudience(recipients), sender);

    await usecase.execute('nl-1');

    expect(saved.map((n) => n.status)).toEqual(['sending', 'sent']);
    // 宛先数は送信開始の時点で確定させる。
    expect(saved[0].recipientCount).toBe(2);
    expect(saved[1].sentCount).toBe(2);
    expect(saved[1].sentAt).not.toBeNull();
  });

  it('送信済みの配信は送らない（2 通目が届く経路を塞ぐ）', async () => {
    const started = draft().withSendingStarted(2);
    if (!started.success) throw new Error('unreachable');
    const sent = started.value.withSendCompleted({ sentCount: 2, failedCount: 0 });

    const { repository } = mockRepository(sent);
    const sender: BulkEmailSenderGateway = { sendBulk: vi.fn() };
    const usecase = new SendNewsletterUsecase(repository, mockAudience(recipients), sender);

    await expect(usecase.execute('nl-1')).rejects.toThrow('すでに送信済み');
    expect(sender.sendBulk).not.toHaveBeenCalled();
  });

  it('宛先が 0 名なら送らない', async () => {
    const { repository } = mockRepository(draft());
    const sender: BulkEmailSenderGateway = { sendBulk: vi.fn() };
    const usecase = new SendNewsletterUsecase(repository, mockAudience([]), sender);

    await expect(usecase.execute('nl-1')).rejects.toThrow('宛先が 0 名');
    expect(sender.sendBulk).not.toHaveBeenCalled();
  });

  it('存在しない id は NotFound', async () => {
    const { repository } = mockRepository(null);
    const sender: BulkEmailSenderGateway = { sendBulk: vi.fn() };
    const usecase = new SendNewsletterUsecase(repository, mockAudience(recipients), sender);

    await expect(usecase.execute('missing')).rejects.toThrow('Newsletter not found');
  });

  it('EMAIL_ENABLED=false は sent にせず draft に戻す（設定を直せば送れる）', async () => {
    const { repository, saved } = mockRepository(draft());
    const sender: BulkEmailSenderGateway = {
      sendBulk: vi.fn().mockResolvedValue({ sent: false, reason: 'disabled' }),
    };
    const usecase = new SendNewsletterUsecase(repository, mockAudience(recipients), sender);

    const result = await usecase.execute('nl-1');

    expect(result.sent).toBe(false);
    expect(result.reason).toBe('disabled');
    expect(result.newsletter.status).toBe('draft');
    expect(saved.at(-1)?.status).toBe('draft');
    expect(saved.at(-1)?.lastError).toContain('disabled');
  });

  it('送信が例外で落ちたら draft に戻して理由を残し、例外は投げ直す', async () => {
    const { repository, saved } = mockRepository(draft());
    const sender: BulkEmailSenderGateway = {
      sendBulk: vi.fn().mockRejectedValue(new Error('network down')),
    };
    const usecase = new SendNewsletterUsecase(repository, mockAudience(recipients), sender);

    await expect(usecase.execute('nl-1')).rejects.toThrow('network down');
    // sending のまま固まると以後永久に送れない。
    expect(saved.at(-1)?.status).toBe('draft');
    expect(saved.at(-1)?.lastError).toBe('network down');
  });

  it('一部が失敗しても sent にし、失敗理由を件数で束ねる（宛先は返さない）', async () => {
    const { repository } = mockRepository(draft());
    const sender: BulkEmailSenderGateway = {
      sendBulk: vi.fn().mockResolvedValue({
        sent: true,
        delivered: 1,
        failures: [
          { to: 'b@example.com', error: 'Resend API 429' },
          { to: 'c@example.com', error: 'Resend API 429' },
          { to: 'd@example.com', error: 'Resend API 500' },
        ],
      }),
    };
    const usecase = new SendNewsletterUsecase(repository, mockAudience(recipients), sender);

    const result = await usecase.execute('nl-1');

    expect(result.newsletter.status).toBe('sent');
    expect(result.failed).toBe(3);
    expect(result.failureReasons).toEqual([
      { reason: 'Resend API 429', count: 2 },
      { reason: 'Resend API 500', count: 1 },
    ]);
    // 失敗した宛先そのものは結果に載せない。
    expect(JSON.stringify(result)).not.toContain('b@example.com');
  });
});
