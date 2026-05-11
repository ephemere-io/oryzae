import { describe, expect, it, vi } from 'vitest';
import { SendFermentationDigestUsecase } from '@/contexts/fermentation/application/usecases/send-fermentation-digest.usecase.js';
import type { EmailNotifier } from '@/contexts/fermentation/domain/gateways/email-notifier.gateway.js';

function mockNotifier(): EmailNotifier {
  return { send: vi.fn().mockResolvedValue({ sent: true }) };
}

// Production と同じフッターを assertion で使う。実装が変わったら exact-match
// で検出されるよう、ここは production と独立にハードコードしておく。
const FOOTER_JA =
  '\n\n———\nこのメールは Oryzae の発酵プロセス完了時に自動配信しています。\n\n' +
  'ヘルプ・FAQ: https://oryzae.ephemere.io/support\n' +
  'プライバシーポリシー: https://oryzae.ephemere.io/privacy\n' +
  'お問い合わせ: oryzae@ephemere.io\n\n' +
  '— Oryzae / Ferment Media Research';

const FOOTER_EN =
  '\n\n———\nThis is an automatic notification from Oryzae,\n' +
  'sent when the fermentation process completes.\n\n' +
  'Help & FAQ: https://oryzae.ephemere.io/support\n' +
  'Privacy: https://oryzae.ephemere.io/privacy\n' +
  'Contact: oryzae@ephemere.io\n\n' +
  '— Oryzae / Ferment Media Research';

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
      subject: '[Oryzae] 瓶のなかで、ことばが醸されました',
      bodyText:
        'あなたが「なぜ働くのか」について綴ったテキストを、Oryzaeの菌たちがゆっくり読みほどき、ひとつの応答へと醸しました。\n\n気が向いたときに、瓶を覗いてみてください。\nhttps://oryzae.ephemere.io/jar' +
        FOOTER_JA,
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
      'あなたが綴った以下の問いをめぐるテキストが、瓶のなかで応答へと醸されました。\n\n・問い A\n・問い B\n\n気が向いたときに、瓶を覗いてみてください。\nhttps://oryzae.ephemere.io/jar' +
        FOOTER_JA,
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
      'あなたが「Q」について綴ったテキストを、Oryzaeの菌たちがゆっくり読みほどき、ひとつの応答へと醸しました。\n\n気が向いたときに、瓶を覗いてみてください。\nhttps://oryzae.ephemere.io/jar' +
        FOOTER_JA,
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
        subject: '[Oryzae] Something has fermented in your jar',
        bodyText:
          'The microbes in your jar have slowly read what you wrote about "Why do I work?", and fermented it into a response.\n\nLook in whenever you have a moment.\nhttps://oryzae.ephemere.io/jar' +
          FOOTER_EN,
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
      expect(call.subject).toBe('[Oryzae] Something has fermented in your jar');
      expect(call.bodyText).toBe(
        'The microbes in your jar have fermented what you wrote around the following questions into responses:\n\n- Why do I work?\n- Who am I to my friends?\n\nLook in whenever you have a moment.\nhttps://oryzae.ephemere.io/jar' +
          FOOTER_EN,
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
      expect(call.subject).toBe('[Oryzae] 瓶のなかで、ことばが醸されました');
      expect(call.bodyText).toContain('Oryzaeの菌たちがゆっくり読みほどき');
    });
  });
});
