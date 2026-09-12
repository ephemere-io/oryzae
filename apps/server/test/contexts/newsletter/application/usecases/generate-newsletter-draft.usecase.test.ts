import { describe, expect, it, vi } from 'vitest';
import { GenerateNewsletterDraftUsecase } from '@/contexts/newsletter/application/usecases/generate-newsletter-draft.usecase.js';
import type {
  ChangelogSourceGateway,
  MergedPullRequest,
} from '@/contexts/newsletter/domain/gateways/changelog-source.gateway.js';
import type { NewsletterDraftGeneratorGateway } from '@/contexts/newsletter/domain/gateways/newsletter-draft-generator.gateway.js';
import type { NewsletterRepositoryGateway } from '@/contexts/newsletter/domain/gateways/newsletter-repository.gateway.js';
import { Newsletter } from '@/contexts/newsletter/domain/models/newsletter.js';

function newsletter(subject: string, sentAt: string | null): Newsletter {
  const created = Newsletter.create(
    { subject, bodyMarkdown: '本文', createdBy: 'admin-1' },
    () => `nl-${subject}`,
  );
  if (!created.success) throw new Error('unreachable');
  if (!sentAt) return created.value;

  const started = created.value.withSendingStarted(1);
  if (!started.success) throw new Error('unreachable');
  return started.value.withSendCompleted({ sentCount: 1, failedCount: 0 }, () => new Date(sentAt));
}

const pullRequests: MergedPullRequest[] = [
  {
    number: 601,
    title: 'feat(study): 鉛筆に NEW を出す',
    mergedAt: '2026-09-10T00:00:00.000Z',
    body: '本文',
    url: 'https://github.com/ephemere-io/oryzae/pull/601',
  },
];

function mocks(options?: { lastSent?: Newsletter | null; prs?: MergedPullRequest[] }) {
  const saved: Newsletter[] = [];
  const repository: NewsletterRepositoryGateway = {
    findById: vi.fn().mockResolvedValue(null),
    listRecent: vi.fn().mockResolvedValue([newsletter('前回の件名', null)]),
    findLastSent: vi.fn().mockResolvedValue(options?.lastSent ?? null),
    save: vi.fn(async (n: Newsletter) => {
      saved.push(n);
    }),
    delete: vi.fn(),
  };
  const changelog: ChangelogSourceGateway = {
    listMergedPullRequests: vi.fn().mockResolvedValue(options?.prs ?? pullRequests),
  };
  const generator: NewsletterDraftGeneratorGateway = {
    generate: vi
      .fn()
      .mockResolvedValue({ subject: '9 月の更新', bodyMarkdown: '## 新機能\n\n- 鉛筆に NEW' }),
  };
  return { repository, changelog, generator, saved };
}

describe('GenerateNewsletterDraftUsecase', () => {
  it('前回配信の時刻を起点に PR を読み、下書きとして保存する', async () => {
    const lastSent = newsletter('前回', '2026-08-01T00:00:00.000Z');
    const { repository, changelog, generator, saved } = mocks({ lastSent });
    const usecase = new GenerateNewsletterDraftUsecase(
      repository,
      changelog,
      generator,
      () => 'nl-new',
    );

    const result = await usecase.execute({ createdBy: 'admin-1' });

    expect(changelog.listMergedPullRequests).toHaveBeenCalledWith(
      new Date('2026-08-01T00:00:00.000Z'),
    );
    expect(result.newsletter.subject).toBe('9 月の更新');
    expect(result.newsletter.status).toBe('draft');
    expect(result.newsletter.createdBy).toBe('admin-1');
    // 生成しただけで消えないよう、必ず保存する。
    expect(saved).toHaveLength(1);
    expect(saved[0].id).toBe('nl-new');
  });

  it('初回（送信済みが無い）は起点 null で呼ぶ', async () => {
    const { repository, changelog, generator } = mocks({ lastSent: null });
    const usecase = new GenerateNewsletterDraftUsecase(
      repository,
      changelog,
      generator,
      () => 'nl-new',
    );

    const result = await usecase.execute({ createdBy: 'admin-1' });

    expect(changelog.listMergedPullRequests).toHaveBeenCalledWith(null);
    expect(result.source.since).toBeNull();
  });

  it('素材にした PR を結果に返す（何を読んで書いたか画面に出すため）', async () => {
    const { repository, changelog, generator } = mocks();
    const usecase = new GenerateNewsletterDraftUsecase(
      repository,
      changelog,
      generator,
      () => 'nl-new',
    );

    const result = await usecase.execute({ createdBy: 'admin-1' });

    expect(result.source.pullRequestCount).toBe(1);
    expect(result.source.pullRequests).toEqual([
      {
        number: 601,
        title: 'feat(study): 鉛筆に NEW を出す',
        url: 'https://github.com/ephemere-io/oryzae/pull/601',
      },
    ]);
  });

  it('直近の件名を LLM に渡す（同じ言い回しを繰り返させない）', async () => {
    const { repository, changelog, generator } = mocks();
    const usecase = new GenerateNewsletterDraftUsecase(
      repository,
      changelog,
      generator,
      () => 'nl-new',
    );

    await usecase.execute({ createdBy: 'admin-1' });

    expect(generator.generate).toHaveBeenCalledWith(
      expect.objectContaining({ previousSubjects: ['前回の件名'] }),
    );
  });

  it('PR が 0 件なら LLM を呼ばずに落とす（嘘のリリースノートを作らせない）', async () => {
    const { repository, changelog, generator, saved } = mocks({ prs: [] });
    const usecase = new GenerateNewsletterDraftUsecase(
      repository,
      changelog,
      generator,
      () => 'nl-new',
    );

    await expect(usecase.execute({ createdBy: 'admin-1' })).rejects.toThrow('PR');
    expect(generator.generate).not.toHaveBeenCalled();
    expect(saved).toHaveLength(0);
  });
});
