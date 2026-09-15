import { describe, expect, it, vi } from 'vitest';
import { PreviewNewsletterUsecase } from '@/contexts/newsletter/application/usecases/preview-newsletter.usecase.js';
import type { NewsletterAudienceGateway } from '@/contexts/newsletter/domain/gateways/newsletter-audience.gateway.js';
import type { NewsletterRepositoryGateway } from '@/contexts/newsletter/domain/gateways/newsletter-repository.gateway.js';
import type {
  NewsletterTranslation,
  NewsletterTranslationRepositoryGateway,
} from '@/contexts/newsletter/domain/gateways/newsletter-translation-repository.gateway.js';
import { Newsletter } from '@/contexts/newsletter/domain/models/newsletter.js';

/** テスト配信済みの下書き（本番送信できる状態）。 */
function draft(): Newsletter {
  return untestedDraft().withTestSent();
}

function untestedDraft(): Newsletter {
  const result = Newsletter.create(
    { subject: '今月の更新', bodyMarkdown: '本文です。', createdBy: 'admin-1' },
    () => 'nl-1',
  );
  if (!result.success) throw new Error('unreachable');
  return result.value;
}

function mockRepository(newsletter: Newsletter | null): NewsletterRepositoryGateway {
  return {
    findById: vi.fn().mockResolvedValue(newsletter),
    listRecent: vi.fn(),
    findLastSent: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  };
}

/** 既定では全員が日本語。en を渡すと英語話者がいる状態になる。 */
function mockAudience(ja: number, en = 0): NewsletterAudienceGateway {
  return {
    countRecipientsByLocale: vi.fn().mockResolvedValue({ ja, en, zh: 0, ko: 0 }),
    listRecipients: vi.fn(),
    listTestRecipients: vi.fn(),
  };
}

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

describe('PreviewNewsletterUsecase', () => {
  it('HTML・テキスト・宛先数を返す（送信前の確認材料）', async () => {
    const audience = mockAudience(137);
    const usecase = new PreviewNewsletterUsecase(
      mockRepository(draft()),
      audience,
      mockTranslations(),
    );

    const preview = await usecase.execute('nl-1');

    expect(preview.subject).toBe('今月の更新');
    expect(preview.html).toContain('本文です。');
    expect(preview.text).toContain('本文です。');
    expect(preview.recipientCount).toBe(137);
    expect(preview.sendable).toBe(true);
  });

  it('宛先数はその時点で数え直す（保存済みの値を使わない）', async () => {
    const audience = mockAudience(5);
    const usecase = new PreviewNewsletterUsecase(
      mockRepository(draft()),
      audience,
      mockTranslations(),
    );

    await usecase.execute('nl-1');

    // 下書きの recipientCount は 0。表示は audience 側の値であること。
    expect(audience.countRecipientsByLocale).toHaveBeenCalledTimes(1);
  });

  it('宛先が 0 名なら送信不可にし、理由を返す', async () => {
    const usecase = new PreviewNewsletterUsecase(
      mockRepository(draft()),
      mockAudience(0),
      mockTranslations(),
    );
    const preview = await usecase.execute('nl-1');

    expect(preview.sendable).toBe(false);
    expect(preview.blockedReason).toBe('no-recipients');
  });

  // 画面が理由を推測すると、サーバーが実際に弾く理由とずれる。
  it('未テストなら送信不可にし、理由を返す', async () => {
    const usecase = new PreviewNewsletterUsecase(
      mockRepository(untestedDraft()),
      mockAudience(5),
      mockTranslations(),
    );
    const preview = await usecase.execute('nl-1');

    expect(preview.sendable).toBe(false);
    expect(preview.blockedReason).toBe('not-tested');
    expect(preview.testSentAt).toBeNull();
    // プレビュー自体は見られる（見ないとテストする気にもならない）。
    expect(preview.html).toContain('本文です。');
  });

  it('送信できる状態なら blockedReason は null', async () => {
    const usecase = new PreviewNewsletterUsecase(
      mockRepository(draft()),
      mockAudience(5),
      mockTranslations(),
    );
    const preview = await usecase.execute('nl-1');

    expect(preview.sendable).toBe(true);
    expect(preview.blockedReason).toBeNull();
  });

  it('送信済みは送信不可にする（プレビューは見られる）', async () => {
    const started = draft().withSendingStarted(3);
    if (!started.success) throw new Error('unreachable');
    const sent = started.value.withSendCompleted({ sentCount: 3, failedCount: 0 });

    const usecase = new PreviewNewsletterUsecase(
      mockRepository(sent),
      mockAudience(3),
      mockTranslations(),
    );
    const preview = await usecase.execute('nl-1');

    expect(preview.sendable).toBe(false);
    expect(preview.blockedReason).toBe('already-sent');
    expect(preview.html).toContain('本文です。');
  });

  // 日本語だけ見て送ると、英語版が崩れていても気づけない。
  it('言語ごとの宛先数と、その言語で届くものを返す', async () => {
    const usecase = new PreviewNewsletterUsecase(
      mockRepository(draft()),
      mockAudience(94, 7),
      mockTranslations([enTranslation]),
    );

    const preview = await usecase.execute('nl-1');

    expect(preview.recipientCount).toBe(101);
    const en = preview.locales.find((l) => l.locale === 'en');
    expect(en?.recipientCount).toBe(7);
    expect(en?.subject).toBe('This month');
    expect(en?.html).toContain('Body in English.');
    // 宛先ゼロの言語も内訳には出す。
    expect(preview.locales.find((l) => l.locale === 'ko')?.recipientCount).toBe(0);
    expect(preview.blockedReason).toBeNull();
  });

  // 原文にフォールバックすると「英語のつもりが日本語で届いた」が黙って起きる。
  it('宛先がいる言語の翻訳が無ければ送信不可にする', async () => {
    const usecase = new PreviewNewsletterUsecase(
      mockRepository(draft()),
      mockAudience(94, 7),
      mockTranslations(),
    );

    const preview = await usecase.execute('nl-1');

    expect(preview.sendable).toBe(false);
    expect(preview.blockedReason).toBe('translations-missing');
    expect(preview.missingTranslations).toEqual(['en']);
    expect(preview.locales.find((l) => l.locale === 'en')?.html).toBeNull();
  });

  it('原文より古い翻訳は「無い」と同じ扱いにする', async () => {
    const stale = { ...enTranslation, sourceBodyMarkdown: '書き換える前の本文' };
    const usecase = new PreviewNewsletterUsecase(
      mockRepository(draft()),
      mockAudience(94, 7),
      mockTranslations([stale]),
    );

    expect((await usecase.execute('nl-1')).missingTranslations).toEqual(['en']);
  });

  // 宛先が 0 名の言語まで要求すると、誰も読まない翻訳に費用を払い続ける。
  it('宛先が 0 名の言語の翻訳は求めない', async () => {
    const usecase = new PreviewNewsletterUsecase(
      mockRepository(draft()),
      mockAudience(94),
      mockTranslations(),
    );

    const preview = await usecase.execute('nl-1');

    expect(preview.missingTranslations).toEqual([]);
    expect(preview.sendable).toBe(true);
  });

  it('存在しない id は NotFound', async () => {
    const usecase = new PreviewNewsletterUsecase(
      mockRepository(null),
      mockAudience(3),
      mockTranslations(),
    );
    await expect(usecase.execute('missing')).rejects.toThrow('Newsletter not found');
  });
});
