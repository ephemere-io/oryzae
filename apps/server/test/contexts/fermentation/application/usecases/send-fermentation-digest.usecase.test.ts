import { describe, expect, it, vi } from 'vitest';
import { SendFermentationDigestUsecase } from '@/contexts/fermentation/application/usecases/send-fermentation-digest.usecase.js';
import type { EmailNotifier } from '@/contexts/fermentation/domain/gateways/email-notifier.gateway.js';

function mockNotifier(): EmailNotifier {
  return { send: vi.fn().mockResolvedValue({ sent: true }) };
}

describe('SendFermentationDigestUsecase', () => {
  it('returns { sent: false, reason: "no-titles" } when there are no question titles', async () => {
    const notifier = mockNotifier();
    const resolve = vi.fn().mockResolvedValue('user@example.com');
    const usecase = new SendFermentationDigestUsecase(notifier, resolve);

    const result = await usecase.execute({ userId: 'u1', questionTitles: [] });

    expect(result).toEqual({ sent: false, reason: 'no-titles' });
    expect(resolve).not.toHaveBeenCalled();
    expect(notifier.send).not.toHaveBeenCalled();
  });

  it('returns "no-verified-email" + warns when resolver returns null (issue #288 / #290)', async () => {
    const notifier = mockNotifier();
    const resolve = vi.fn().mockResolvedValue(null);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const usecase = new SendFermentationDigestUsecase(notifier, resolve);

    const result = await usecase.execute({ userId: 'u1', questionTitles: ['Q1'] });

    expect(result).toEqual({ sent: false, reason: 'no-verified-email' });
    expect(resolve).toHaveBeenCalledWith('u1');
    expect(notifier.send).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      '[SendFermentationDigestUsecase] skipped — verified email not found',
      expect.objectContaining({ userId: 'u1', titleCount: 1 }),
    );
    warnSpy.mockRestore();
  });

  it('forwards the notifier result (e.g. { sent: false, reason: "no-api-key" }) verbatim', async () => {
    const notifier: EmailNotifier = {
      send: vi.fn().mockResolvedValue({ sent: false, reason: 'no-api-key' }),
    };
    const usecase = new SendFermentationDigestUsecase(
      notifier,
      vi.fn().mockResolvedValue('user@example.com'),
    );

    const result = await usecase.execute({ userId: 'u1', questionTitles: ['Q'] });

    expect(result).toEqual({ sent: false, reason: 'no-api-key' });
  });

  it('returns { sent: true } when the notifier successfully sends', async () => {
    const notifier = mockNotifier();
    const usecase = new SendFermentationDigestUsecase(
      notifier,
      vi.fn().mockResolvedValue('user@example.com'),
    );

    const result = await usecase.execute({ userId: 'u1', questionTitles: ['Q'] });

    expect(result).toEqual({ sent: true });
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
        'なぜ働くのかについてあなたが書いたテキストに、Oryzaeの菌たちが反応を生成しました。\nhttps://oryzae.ephemere.io/jar',
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
      '以下の問いについてあなたが書いたテキストに、Oryzaeの菌たちが反応を生成しました。\n\n・問い A\n・問い B\n\nhttps://oryzae.ephemere.io/jar',
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
      'Qについてあなたが書いたテキストに、Oryzaeの菌たちが反応を生成しました。\nhttps://oryzae.ephemere.io/jar',
    );
  });

  describe('issue #279: language switching', () => {
    it('uses English subject and single-title body when language="en"', async () => {
      const notifier = mockNotifier();
      const usecase = new SendFermentationDigestUsecase(
        notifier,
        vi.fn().mockResolvedValue('user@example.com'),
      );

      await usecase.execute({
        userId: 'u1',
        questionTitles: ['Why do I work?'],
        language: 'en',
      });

      expect(notifier.send).toHaveBeenCalledWith({
        to: 'user@example.com',
        subject: 'Your jar has fermented further',
        bodyText:
          'Oryzae\'s microbes have responded to what you wrote about "Why do I work?".\nhttps://oryzae.ephemere.io/jar',
      });
    });

    it('uses English bullet-list body for multiple titles when language="en"', async () => {
      const notifier = mockNotifier();
      const usecase = new SendFermentationDigestUsecase(
        notifier,
        vi.fn().mockResolvedValue('user@example.com'),
      );

      await usecase.execute({
        userId: 'u1',
        questionTitles: ['Why do I work?', 'Who am I to my friends?'],
        language: 'en',
      });

      const call = vi.mocked(notifier.send).mock.calls[0][0];
      expect(call.subject).toBe('Your jar has fermented further');
      expect(call.bodyText).toBe(
        "Oryzae's microbes have responded to what you wrote about the following questions:\n\n- Why do I work?\n- Who am I to my friends?\n\nhttps://oryzae.ephemere.io/jar",
      );
    });

    it('falls back to Japanese when language is omitted', async () => {
      const notifier = mockNotifier();
      const usecase = new SendFermentationDigestUsecase(
        notifier,
        vi.fn().mockResolvedValue('user@example.com'),
      );

      await usecase.execute({ userId: 'u1', questionTitles: ['なぜ働くのか'] });

      const call = vi.mocked(notifier.send).mock.calls[0][0];
      expect(call.subject).toBe('あなたの瓶の発酵が進みました');
      expect(call.bodyText).toContain('Oryzaeの菌たちが反応を生成しました');
    });
  });
});
