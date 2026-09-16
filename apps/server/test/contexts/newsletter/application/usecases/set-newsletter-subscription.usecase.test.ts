import { describe, expect, it, vi } from 'vitest';
import { SetNewsletterSubscriptionUsecase } from '@/contexts/newsletter/application/usecases/set-newsletter-subscription.usecase.js';
import type { NewsletterSubscriptionRepositoryGateway } from '@/contexts/newsletter/domain/gateways/newsletter-subscription-repository.gateway.js';
import type { UnsubscribeTokenGateway } from '@/contexts/newsletter/domain/gateways/unsubscribe-token.gateway.js';

function mockTokens(userId: string | null): UnsubscribeTokenGateway {
  return { issue: vi.fn(), verify: vi.fn().mockReturnValue(userId) };
}

function mockRepository(found = true): NewsletterSubscriptionRepositoryGateway {
  return { setOptOut: vi.fn().mockResolvedValue(found) };
}

describe('SetNewsletterSubscriptionUsecase', () => {
  it('トークンから復元した user_id の配信を止める', async () => {
    const tokens = mockTokens('u1');
    const repository = mockRepository();
    const usecase = new SetNewsletterSubscriptionUsecase(tokens, repository);

    const result = await usecase.execute({ token: 'tok', optOut: true });

    expect(tokens.verify).toHaveBeenCalledWith('tok');
    expect(repository.setOptOut).toHaveBeenCalledWith('u1', true);
    expect(result).toEqual({ optOut: true });
  });

  it('同じトークンで配信を再開できる（押し間違いからログインなしで戻れる）', async () => {
    const repository = mockRepository();
    const usecase = new SetNewsletterSubscriptionUsecase(mockTokens('u1'), repository);

    const result = await usecase.execute({ token: 'tok', optOut: false });

    expect(repository.setOptOut).toHaveBeenCalledWith('u1', false);
    expect(result).toEqual({ optOut: false });
  });

  // ここが破れると、他人を勝手に配信停止にできる。
  it('署名が壊れたトークンでは何も書かない', async () => {
    const repository = mockRepository();
    const usecase = new SetNewsletterSubscriptionUsecase(mockTokens(null), repository);

    await expect(usecase.execute({ token: 'forged', optOut: true })).rejects.toThrow(
      'このリンクは無効です',
    );
    expect(repository.setOptOut).not.toHaveBeenCalled();
  });

  it('対象の利用者がもういない場合も同じエラー（実在する id を探らせない）', async () => {
    const usecase = new SetNewsletterSubscriptionUsecase(mockTokens('gone'), mockRepository(false));

    await expect(usecase.execute({ token: 'tok', optOut: true })).rejects.toThrow(
      'このリンクは無効です',
    );
  });

  it('不正なトークンは 400（サーバーの不具合ではないため）', async () => {
    const usecase = new SetNewsletterSubscriptionUsecase(mockTokens(null), mockRepository());

    await expect(usecase.execute({ token: 'forged', optOut: true })).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});
