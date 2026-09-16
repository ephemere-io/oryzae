import { describe, expect, it, vi } from 'vitest';
import { SendNewsletterTestUsecase } from '@/contexts/newsletter/application/usecases/send-newsletter-test.usecase.js';
import type { BulkEmailSenderGateway } from '@/contexts/newsletter/domain/gateways/bulk-email-sender.gateway.js';
import type {
  NewsletterAudienceGateway,
  NewsletterRecipient,
} from '@/contexts/newsletter/domain/gateways/newsletter-audience.gateway.js';
import type { NewsletterRepositoryGateway } from '@/contexts/newsletter/domain/gateways/newsletter-repository.gateway.js';
import type {
  NewsletterTranslation,
  NewsletterTranslationRepositoryGateway,
} from '@/contexts/newsletter/domain/gateways/newsletter-translation-repository.gateway.js';
import type { UnsubscribeTokenGateway } from '@/contexts/newsletter/domain/gateways/unsubscribe-token.gateway.js';
import { Newsletter } from '@/contexts/newsletter/domain/models/newsletter.js';

function draft(): Newsletter {
  const result = Newsletter.create(
    { subject: '今月の更新', bodyMarkdown: '本文です。', createdBy: 'admin-1' },
    () => 'nl-1',
  );
  if (!result.success) throw new Error('unreachable');
  return result.value;
}

function mockRepository(initial: Newsletter | null) {
  const saved: Newsletter[] = [];
  const repository: NewsletterRepositoryGateway = {
    findById: vi.fn().mockResolvedValue(initial),
    listRecent: vi.fn(),
    findLastSent: vi.fn(),
    save: vi.fn(async (n: Newsletter) => {
      saved.push(n);
    }),
    delete: vi.fn(),
  };
  return { repository, saved };
}

const admins: NewsletterRecipient[] = [
  { userId: 'admin-1', email: 'admin1@example.com', locale: 'ja' },
  { userId: 'admin-2', email: 'admin2@example.com', locale: 'ja' },
];

const everyone: NewsletterRecipient[] = Array.from({ length: 200 }, (_, i) => ({
  userId: `u${i}`,
  email: `user${i}@example.com`,
  locale: 'ja' as const,
}));

function mockAudience(test: NewsletterRecipient[] = admins): NewsletterAudienceGateway {
  return {
    countRecipientsByLocale: vi
      .fn()
      .mockResolvedValue({ ja: everyone.length, en: 0, zh: 0, ko: 0 }),
    listRecipients: vi.fn().mockResolvedValue(everyone),
    listTestRecipients: vi.fn().mockResolvedValue(test),
  };
}

/** 翻訳リポジトリのスタブ。既定は「翻訳なし」。 */
function mockTranslations(
  items: NewsletterTranslation[] = [],
): NewsletterTranslationRepositoryGateway {
  return { listByNewsletterId: vi.fn().mockResolvedValue(items), save: vi.fn() };
}

const enTranslation: NewsletterTranslation = {
  locale: 'en',
  subject: 'This month',
  bodyMarkdown: 'Body in English.',
  sourceSubject: '今月の更新',
  sourceBodyMarkdown: '本文です。',
  updatedAt: '2026-09-15T00:00:00.000Z',
};

function mockTokens(): UnsubscribeTokenGateway {
  return { issue: vi.fn((userId: string) => `tok-${userId}`), verify: vi.fn() };
}

function okSender(): BulkEmailSenderGateway {
  return { sendBulk: vi.fn().mockResolvedValue({ sent: true, delivered: 2, failures: [] }) };
}

describe('SendNewsletterTestUsecase', () => {
  // ここが崩れると、テストのつもりで 200 人に配信してしまう。
  it('運営者だけに送る（本番の宛先を引かない）', async () => {
    const { repository } = mockRepository(draft());
    const audience = mockAudience();
    const sender = okSender();
    const usecase = new SendNewsletterTestUsecase(
      repository,
      audience,
      sender,
      mockTokens(),
      mockTranslations(),
    );

    const result = await usecase.execute('nl-1');

    expect(audience.listTestRecipients).toHaveBeenCalled();
    expect(audience.listRecipients).not.toHaveBeenCalled();

    const messages = vi.mocked(sender.sendBulk).mock.calls[0][0];
    expect(messages.map((m) => m.to)).toEqual(['admin1@example.com', 'admin2@example.com']);
    expect(result.recipients).toEqual(['admin1@example.com', 'admin2@example.com']);
  });

  // 1 言語ずつ確認していると、訳が崩れている言語に気づかないまま本番を撃つ。
  it('翻訳がある言語ぶんも運営者へ送る（言語ごとに 1 通）', async () => {
    const { repository } = mockRepository(draft());
    const sender: BulkEmailSenderGateway = {
      sendBulk: vi.fn().mockResolvedValue({ sent: true, delivered: 4, failures: [] }),
    };
    const usecase = new SendNewsletterTestUsecase(
      repository,
      mockAudience(),
      sender,
      mockTokens(),
      mockTranslations([enTranslation]),
    );

    const result = await usecase.execute('nl-1');

    expect(result.locales).toEqual(['ja', 'en']);
    // 運営者 2 名 × 2 言語。
    const messages = vi.mocked(sender.sendBulk).mock.calls[0][0];
    expect(messages).toHaveLength(4);
    expect(messages.map((m) => m.subject)).toEqual([
      '[テスト配信/ja] 今月の更新',
      '[テスト配信/en] This month',
      '[テスト配信/ja] 今月の更新',
      '[テスト配信/en] This month',
    ]);
    // 英語版は英語のフッターで届く。
    const english = messages.find((m) => m.subject.includes('/en'));
    expect(english?.html).toContain('Unsubscribe from these announcements');
    expect(english?.html).toContain('Body in English.');
  });

  it('原文より古い翻訳は送らない（確認したつもりで古い訳が届く）', async () => {
    const { repository } = mockRepository(draft());
    const stale = { ...enTranslation, sourceBodyMarkdown: '書き換える前の本文' };
    const usecase = new SendNewsletterTestUsecase(
      repository,
      mockAudience(),
      okSender(),
      mockTokens(),
      mockTranslations([stale]),
    );

    expect((await usecase.execute('nl-1')).locales).toEqual(['ja']);
  });

  it('件名に [テスト配信] を付ける（受信箱で本番と見分けるため）', async () => {
    const { repository } = mockRepository(draft());
    const sender = okSender();
    const usecase = new SendNewsletterTestUsecase(
      repository,
      mockAudience(),
      sender,
      mockTokens(),
      mockTranslations(),
    );

    await usecase.execute('nl-1');

    const messages = vi.mocked(sender.sendBulk).mock.calls[0][0];
    expect(messages[0].subject).toBe('[テスト配信/ja] 今月の更新');
  });

  it('本文は本番と同一（配信停止リンクも本物を載せる）', async () => {
    const { repository } = mockRepository(draft());
    const sender = okSender();
    const usecase = new SendNewsletterTestUsecase(
      repository,
      mockAudience(),
      sender,
      mockTokens(),
      mockTranslations(),
    );

    await usecase.execute('nl-1');

    const messages = vi.mocked(sender.sendBulk).mock.calls[0][0];
    expect(messages[0].html).toContain('本文です。');
    // リンクが本当に効くかを確かめられないと、テストの意味が半分無くなる。
    expect(messages[0].unsubscribeUrl).toBe(
      'https://oryzae.ephemere.io/unsubscribe?token=tok-admin-1',
    );
    expect(messages[0].html).toContain('token=tok-admin-1');
    // 件名の印は本文に混ざらない。
    expect(messages[0].html).not.toContain('[テスト配信');
  });

  // テスト配信で sent になると、本番配信ができなくなる。
  it('status を動かさず、testSentAt だけを記録する', async () => {
    const { repository, saved } = mockRepository(draft());
    const usecase = new SendNewsletterTestUsecase(
      repository,
      mockAudience(),
      okSender(),
      mockTokens(),
      mockTranslations(),
    );

    const result = await usecase.execute('nl-1');

    expect(result.newsletter.status).toBe('draft');
    expect(result.newsletter.sentAt).toBeNull();
    expect(result.newsletter.sentCount).toBe(0);
    expect(result.newsletter.testSentAt).not.toBeNull();
    expect(saved).toHaveLength(1);
    expect(saved[0].status).toBe('draft');
  });

  it('何度でもテストできる', async () => {
    const first = draft().withTestSent(() => new Date('2026-09-14T00:00:00.000Z'));
    const { repository, saved } = mockRepository(first);
    const usecase = new SendNewsletterTestUsecase(
      repository,
      mockAudience(),
      okSender(),
      mockTokens(),
      mockTranslations(),
    );

    const result = await usecase.execute('nl-1');

    expect(result.sent).toBe(true);
    expect(saved[0].testSentAt).not.toBe('2026-09-14T00:00:00.000Z');
  });

  it('送信済みの配信はテストできない（もう文面を変えられない）', async () => {
    const started = draft().withTestSent().withSendingStarted(2);
    if (!started.success) throw new Error('unreachable');
    const sent = started.value.withSendCompleted({ sentCount: 2, failedCount: 0 });

    const { repository } = mockRepository(sent);
    const sender = okSender();
    const usecase = new SendNewsletterTestUsecase(
      repository,
      mockAudience(),
      sender,
      mockTokens(),
      mockTranslations(),
    );

    await expect(usecase.execute('nl-1')).rejects.toThrow('下書きのみテスト配信できます');
    expect(sender.sendBulk).not.toHaveBeenCalled();
  });

  it('運営者が 1 人も見つからなければ落とす（黙って 0 通送らない）', async () => {
    const { repository } = mockRepository(draft());
    const sender = okSender();
    const usecase = new SendNewsletterTestUsecase(
      repository,
      mockAudience([]),
      sender,
      mockTokens(),
      mockTranslations(),
    );

    await expect(usecase.execute('nl-1')).rejects.toThrow('テスト配信の宛先がいません');
    expect(sender.sendBulk).not.toHaveBeenCalled();
  });

  // 送れていないのに「テスト済み」の印が付くと、確認しないまま本番を撃つ。
  it('送信されなかったときは testSentAt を記録しない', async () => {
    const { repository, saved } = mockRepository(draft());
    const sender: BulkEmailSenderGateway = {
      sendBulk: vi.fn().mockResolvedValue({ sent: false, reason: 'no-api-key' }),
    };
    const usecase = new SendNewsletterTestUsecase(
      repository,
      mockAudience(),
      sender,
      mockTokens(),
      mockTranslations(),
    );

    const result = await usecase.execute('nl-1');

    expect(result.sent).toBe(false);
    expect(result.reason).toBe('no-api-key');
    expect(result.newsletter.testSentAt).toBeNull();
    expect(saved).toHaveLength(0);
  });

  it('存在しない id は NotFound', async () => {
    const { repository } = mockRepository(null);
    const usecase = new SendNewsletterTestUsecase(
      repository,
      mockAudience(),
      okSender(),
      mockTokens(),
      mockTranslations(),
    );

    await expect(usecase.execute('missing')).rejects.toThrow('Newsletter not found');
  });
});
