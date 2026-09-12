import { describe, expect, it, vi } from 'vitest';
import { PreviewNewsletterUsecase } from '@/contexts/newsletter/application/usecases/preview-newsletter.usecase.js';
import type { NewsletterAudienceGateway } from '@/contexts/newsletter/domain/gateways/newsletter-audience.gateway.js';
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

function mockRepository(newsletter: Newsletter | null): NewsletterRepositoryGateway {
  return {
    findById: vi.fn().mockResolvedValue(newsletter),
    listRecent: vi.fn(),
    findLastSent: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  };
}

function mockAudience(count: number): NewsletterAudienceGateway {
  return {
    countRecipients: vi.fn().mockResolvedValue(count),
    listRecipients: vi.fn(),
  };
}

describe('PreviewNewsletterUsecase', () => {
  it('HTML・テキスト・宛先数を返す（送信前の確認材料）', async () => {
    const audience = mockAudience(137);
    const usecase = new PreviewNewsletterUsecase(mockRepository(draft()), audience);

    const preview = await usecase.execute('nl-1');

    expect(preview.subject).toBe('今月の更新');
    expect(preview.html).toContain('本文です。');
    expect(preview.text).toContain('本文です。');
    expect(preview.recipientCount).toBe(137);
    expect(preview.sendable).toBe(true);
  });

  it('宛先数はその時点で数え直す（保存済みの値を使わない）', async () => {
    const audience = mockAudience(5);
    const usecase = new PreviewNewsletterUsecase(mockRepository(draft()), audience);

    await usecase.execute('nl-1');

    // 下書きの recipientCount は 0。表示は audience 側の値であること。
    expect(audience.countRecipients).toHaveBeenCalledTimes(1);
  });

  it('宛先が 0 名なら送信不可にする', async () => {
    const usecase = new PreviewNewsletterUsecase(mockRepository(draft()), mockAudience(0));
    expect((await usecase.execute('nl-1')).sendable).toBe(false);
  });

  it('送信済みは送信不可にする（プレビューは見られる）', async () => {
    const started = draft().withSendingStarted(3);
    if (!started.success) throw new Error('unreachable');
    const sent = started.value.withSendCompleted({ sentCount: 3, failedCount: 0 });

    const usecase = new PreviewNewsletterUsecase(mockRepository(sent), mockAudience(3));
    const preview = await usecase.execute('nl-1');

    expect(preview.sendable).toBe(false);
    expect(preview.html).toContain('本文です。');
  });

  it('存在しない id は NotFound', async () => {
    const usecase = new PreviewNewsletterUsecase(mockRepository(null), mockAudience(3));
    await expect(usecase.execute('missing')).rejects.toThrow('Newsletter not found');
  });
});
