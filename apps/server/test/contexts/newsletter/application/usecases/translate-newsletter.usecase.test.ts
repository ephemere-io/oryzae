import { describe, expect, it, vi } from 'vitest';
import { TranslateNewsletterUsecase } from '@/contexts/newsletter/application/usecases/translate-newsletter.usecase.js';
import type { NewsletterAudienceGateway } from '@/contexts/newsletter/domain/gateways/newsletter-audience.gateway.js';
import type { NewsletterRepositoryGateway } from '@/contexts/newsletter/domain/gateways/newsletter-repository.gateway.js';
import type {
  NewsletterTranslation,
  NewsletterTranslationRepositoryGateway,
} from '@/contexts/newsletter/domain/gateways/newsletter-translation-repository.gateway.js';
import type { NewsletterTranslatorGateway } from '@/contexts/newsletter/domain/gateways/newsletter-translator.gateway.js';
import { Newsletter } from '@/contexts/newsletter/domain/models/newsletter.js';

function draft(): Newsletter {
  const result = Newsletter.create(
    { subject: '今月の更新', bodyMarkdown: '本文です。', createdBy: 'admin-1' },
    () => 'nl-1',
  );
  if (!result.success) throw new Error('unreachable');
  return result.value;
}

function mockRepository(initial: Newsletter | null): NewsletterRepositoryGateway {
  return {
    findById: vi.fn().mockResolvedValue(initial),
    listRecent: vi.fn(),
    findLastSent: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  };
}

function mockAudience(counts: {
  ja?: number;
  en?: number;
  zh?: number;
  ko?: number;
}): NewsletterAudienceGateway {
  return {
    countRecipientsByLocale: vi.fn().mockResolvedValue({ ja: 0, en: 0, zh: 0, ko: 0, ...counts }),
    listRecipients: vi.fn(),
    listTestRecipients: vi.fn(),
  };
}

function mockTranslations(items: NewsletterTranslation[] = []) {
  const saved: Array<{ newsletterId: string; translation: NewsletterTranslation }> = [];
  const repository: NewsletterTranslationRepositoryGateway = {
    listByNewsletterId: vi.fn().mockResolvedValue(items),
    save: vi.fn(async (newsletterId: string, translation: NewsletterTranslation) => {
      saved.push({ newsletterId, translation });
    }),
  };
  return { repository, saved };
}

function mockTranslator(): NewsletterTranslatorGateway {
  return {
    translate: vi.fn(async ({ targetLocale }) => ({
      subject: `subject-${targetLocale}`,
      bodyMarkdown: `body-${targetLocale}`,
    })),
  };
}

const at = () => new Date('2026-09-15T00:00:00.000Z');

describe('TranslateNewsletterUsecase', () => {
  it('宛先がいる言語だけ訳す', async () => {
    const { repository: translations, saved } = mockTranslations();
    const translator = mockTranslator();
    const usecase = new TranslateNewsletterUsecase(
      mockRepository(draft()),
      translations,
      mockAudience({ ja: 94, en: 7, zh: 1 }),
      translator,
      at,
    );

    const result = await usecase.execute('nl-1');

    expect(result.translated).toEqual(['en', 'zh']);
    expect(saved.map((s) => s.translation.locale)).toEqual(['en', 'zh']);
    // 韓国語の登録者は 0 名なので訳さない。
    expect(vi.mocked(translator.translate).mock.calls.map((c) => c[0].targetLocale)).toEqual([
      'en',
      'zh',
    ]);
  });

  it('日本語は訳さない（原文なので）', async () => {
    const translator = mockTranslator();
    const usecase = new TranslateNewsletterUsecase(
      mockRepository(draft()),
      mockTranslations().repository,
      mockAudience({ ja: 94 }),
      translator,
      at,
    );

    const result = await usecase.execute('nl-1');

    expect(result.translated).toEqual([]);
    expect(translator.translate).not.toHaveBeenCalled();
  });

  it('訳したときの原文を一緒に保存する（あとで古さを判定するため）', async () => {
    const { repository: translations, saved } = mockTranslations();
    const usecase = new TranslateNewsletterUsecase(
      mockRepository(draft()),
      translations,
      mockAudience({ en: 7 }),
      mockTranslator(),
      at,
    );

    await usecase.execute('nl-1');

    expect(saved[0].translation).toMatchObject({
      locale: 'en',
      subject: 'subject-en',
      bodyMarkdown: 'body-en',
      sourceSubject: '今月の更新',
      sourceBodyMarkdown: '本文です。',
      updatedAt: '2026-09-15T00:00:00.000Z',
    });
  });

  // 同じ内容に二度払わない。
  it('原文が変わっていない言語は訳し直さない', async () => {
    const fresh: NewsletterTranslation = {
      locale: 'en',
      subject: 'This month',
      bodyMarkdown: 'Body.',
      sourceSubject: '今月の更新',
      sourceBodyMarkdown: '本文です。',
      updatedAt: '2026-09-14T00:00:00.000Z',
    };
    const { repository: translations, saved } = mockTranslations([fresh]);
    const translator = mockTranslator();
    const usecase = new TranslateNewsletterUsecase(
      mockRepository(draft()),
      translations,
      mockAudience({ en: 7 }),
      translator,
      at,
    );

    const result = await usecase.execute('nl-1');

    expect(result.skipped).toEqual(['en']);
    expect(result.translated).toEqual([]);
    expect(translator.translate).not.toHaveBeenCalled();
    expect(saved).toHaveLength(0);
  });

  it('原文が変わっていれば訳し直す', async () => {
    const stale: NewsletterTranslation = {
      locale: 'en',
      subject: 'Old',
      bodyMarkdown: 'Old body.',
      sourceSubject: '今月の更新',
      sourceBodyMarkdown: '書き換える前の本文',
      updatedAt: '2026-09-14T00:00:00.000Z',
    };
    const { repository: translations, saved } = mockTranslations([stale]);
    const usecase = new TranslateNewsletterUsecase(
      mockRepository(draft()),
      translations,
      mockAudience({ en: 7 }),
      mockTranslator(),
      at,
    );

    const result = await usecase.execute('nl-1');

    expect(result.translated).toEqual(['en']);
    expect(saved[0].translation.bodyMarkdown).toBe('body-en');
  });

  it('送信済みは翻訳できない（届いたメールは変わらない）', async () => {
    const started = draft().withTestSent().withSendingStarted(1);
    if (!started.success) throw new Error('unreachable');
    const sent = started.value.withSendCompleted({ sentCount: 1, failedCount: 0 });

    const translator = mockTranslator();
    const usecase = new TranslateNewsletterUsecase(
      mockRepository(sent),
      mockTranslations().repository,
      mockAudience({ en: 7 }),
      translator,
      at,
    );

    await expect(usecase.execute('nl-1')).rejects.toThrow('下書きのみ翻訳できます');
    expect(translator.translate).not.toHaveBeenCalled();
  });

  it('存在しない id は NotFound', async () => {
    const usecase = new TranslateNewsletterUsecase(
      mockRepository(null),
      mockTranslations().repository,
      mockAudience({ en: 7 }),
      mockTranslator(),
      at,
    );

    await expect(usecase.execute('missing')).rejects.toThrow('Newsletter not found');
  });
});
