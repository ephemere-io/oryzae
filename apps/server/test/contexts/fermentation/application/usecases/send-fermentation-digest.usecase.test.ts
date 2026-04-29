import { describe, expect, it, vi } from 'vitest';
import { SendFermentationDigestUsecase } from '@/contexts/fermentation/application/usecases/send-fermentation-digest.usecase.js';
import type { EmailNotifier } from '@/contexts/fermentation/domain/gateways/email-notifier.gateway.js';

function mockNotifier(): EmailNotifier {
  return { send: vi.fn().mockResolvedValue(undefined) };
}

describe('SendFermentationDigestUsecase', () => {
  it('no-ops when there are no question titles', async () => {
    const notifier = mockNotifier();
    const resolve = vi.fn().mockResolvedValue('user@example.com');
    const usecase = new SendFermentationDigestUsecase(notifier, resolve);

    await usecase.execute({ userId: 'u1', questionTitles: [] });

    expect(resolve).not.toHaveBeenCalled();
    expect(notifier.send).not.toHaveBeenCalled();
  });

  it('no-ops when resolver returns null (unverified or missing email)', async () => {
    const notifier = mockNotifier();
    const resolve = vi.fn().mockResolvedValue(null);
    const usecase = new SendFermentationDigestUsecase(notifier, resolve);

    await usecase.execute({ userId: 'u1', questionTitles: ['Q1'] });

    expect(resolve).toHaveBeenCalledWith('u1');
    expect(notifier.send).not.toHaveBeenCalled();
  });

  it('sends single-title body in the original issue wording', async () => {
    const notifier = mockNotifier();
    const usecase = new SendFermentationDigestUsecase(
      notifier,
      vi.fn().mockResolvedValue('user@example.com'),
    );

    await usecase.execute({ userId: 'u1', questionTitles: ['なぜ働くのか'] });

    expect(notifier.send).toHaveBeenCalledOnce();
    expect(notifier.send).toHaveBeenCalledWith({
      to: 'user@example.com',
      subject: 'あなたの瓶の発酵が進みました',
      bodyText:
        'なぜ働くのかについてあなたが書いたテキストに、Oryzaeの菌たちが反応を生成しました。\nhttps://oryzae-client.vercel.app/jar',
    });
  });

  it('sends bullet list body for multiple unique titles', async () => {
    const notifier = mockNotifier();
    const usecase = new SendFermentationDigestUsecase(
      notifier,
      vi.fn().mockResolvedValue('user@example.com'),
    );

    await usecase.execute({
      userId: 'u1',
      questionTitles: ['問い A', '問い B'],
    });

    expect(notifier.send).toHaveBeenCalledOnce();
    const call = vi.mocked(notifier.send).mock.calls[0][0];
    expect(call.bodyText).toBe(
      '以下の問いについてあなたが書いたテキストに、Oryzaeの菌たちが反応を生成しました。\n\n・問い A\n・問い B\n\nhttps://oryzae-client.vercel.app/jar',
    );
  });

  it('dedupes and trims titles before composing the body', async () => {
    const notifier = mockNotifier();
    const usecase = new SendFermentationDigestUsecase(
      notifier,
      vi.fn().mockResolvedValue('user@example.com'),
    );

    await usecase.execute({
      userId: 'u1',
      questionTitles: ['問い A', '  問い A  ', '', '問い B'],
    });

    const call = vi.mocked(notifier.send).mock.calls[0][0];
    expect(call.bodyText).toContain('・問い A');
    expect(call.bodyText).toContain('・問い B');
    expect(call.bodyText.match(/・問い A/g)).toHaveLength(1);
  });

  it('sends single-title body when only one title remains after trim/dedupe', async () => {
    const notifier = mockNotifier();
    const usecase = new SendFermentationDigestUsecase(
      notifier,
      vi.fn().mockResolvedValue('user@example.com'),
    );

    await usecase.execute({
      userId: 'u1',
      questionTitles: ['Q', '  Q  ', ''],
    });

    const call = vi.mocked(notifier.send).mock.calls[0][0];
    expect(call.bodyText).toBe(
      'Qについてあなたが書いたテキストに、Oryzaeの菌たちが反応を生成しました。\nhttps://oryzae-client.vercel.app/jar',
    );
  });
});
