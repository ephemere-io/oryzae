import { describe, expect, it, vi } from 'vitest';
import { CreateNewsletterUsecase } from '@/contexts/newsletter/application/usecases/create-newsletter.usecase.js';
import { DeleteNewsletterUsecase } from '@/contexts/newsletter/application/usecases/delete-newsletter.usecase.js';
import { UpdateNewsletterUsecase } from '@/contexts/newsletter/application/usecases/update-newsletter.usecase.js';
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

function sentNewsletter(): Newsletter {
  const started = draft().withSendingStarted(3);
  if (!started.success) throw new Error('unreachable');
  return started.value.withSendCompleted({ sentCount: 3, failedCount: 0 });
}

function mockRepository(newsletter: Newsletter | null) {
  const saved: Newsletter[] = [];
  const repository: NewsletterRepositoryGateway = {
    findById: vi.fn().mockResolvedValue(newsletter),
    listRecent: vi.fn(),
    findLastSent: vi.fn(),
    save: vi.fn(async (n: Newsletter) => {
      saved.push(n);
    }),
    delete: vi.fn(),
  };
  return { repository, saved };
}

describe('CreateNewsletterUsecase', () => {
  it('下書きを保存して返す', async () => {
    const { repository, saved } = mockRepository(null);
    const usecase = new CreateNewsletterUsecase(repository, () => 'nl-1');

    const created = await usecase.execute({
      subject: '今月の更新',
      bodyMarkdown: '本文です。',
      createdBy: 'admin-1',
    });

    expect(created.id).toBe('nl-1');
    expect(created.status).toBe('draft');
    expect(created.createdBy).toBe('admin-1');
    expect(saved).toHaveLength(1);
  });

  it('domain のバリデーション違反を 400 (ValidationError) に変換する', async () => {
    const { repository, saved } = mockRepository(null);
    const usecase = new CreateNewsletterUsecase(repository, () => 'nl-1');

    await expect(
      usecase.execute({ subject: '  ', bodyMarkdown: '本文', createdBy: 'admin-1' }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(saved).toHaveLength(0);
  });
});

describe('UpdateNewsletterUsecase', () => {
  it('下書きの件名と本文を差し替える', async () => {
    const { repository, saved } = mockRepository(draft());
    const usecase = new UpdateNewsletterUsecase(repository);

    const updated = await usecase.execute({
      id: 'nl-1',
      subject: '差し替え',
      bodyMarkdown: '新しい本文',
    });

    expect(updated.subject).toBe('差し替え');
    expect(saved.at(-1)?.bodyMarkdown).toBe('新しい本文');
  });

  it('送信済みは編集できない', async () => {
    const { repository, saved } = mockRepository(sentNewsletter());
    const usecase = new UpdateNewsletterUsecase(repository);

    await expect(usecase.execute({ id: 'nl-1', subject: 'x', bodyMarkdown: 'y' })).rejects.toThrow(
      '編集できません',
    );
    expect(saved).toHaveLength(0);
  });

  it('存在しない id は NotFound', async () => {
    const { repository } = mockRepository(null);
    const usecase = new UpdateNewsletterUsecase(repository);

    await expect(
      usecase.execute({ id: 'missing', subject: 'x', bodyMarkdown: 'y' }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('DeleteNewsletterUsecase', () => {
  it('下書きは削除できる', async () => {
    const { repository } = mockRepository(draft());
    const usecase = new DeleteNewsletterUsecase(repository);

    await usecase.execute('nl-1');

    expect(repository.delete).toHaveBeenCalledWith('nl-1');
  });

  it('送信済みは削除できない（誰に何を送ったかの履歴を消させない）', async () => {
    const { repository } = mockRepository(sentNewsletter());
    const usecase = new DeleteNewsletterUsecase(repository);

    await expect(usecase.execute('nl-1')).rejects.toThrow('削除できません');
    expect(repository.delete).not.toHaveBeenCalled();
  });
});
