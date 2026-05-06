import type { EmailNotifier } from '../../domain/gateways/email-notifier.gateway.js';
import type { FermentationLanguage } from '../../domain/services/fermentation-eligibility.service.js';

const JAR_URL = 'https://oryzae-client.vercel.app/jar';

// issue #279: ユーザー言語に合わせて subject / body を切り替える。
const COPY: Record<
  FermentationLanguage,
  {
    subject: string;
    singleBody: (title: string) => string;
    multiBody: (titles: string[]) => string;
  }
> = {
  ja: {
    subject: 'あなたの瓶の発酵が進みました',
    singleBody: (title) =>
      `${title}についてあなたが書いたテキストに、Oryzaeの菌たちが反応を生成しました。\n${JAR_URL}`,
    multiBody: (titles) => {
      const list = titles.map((t) => `・${t}`).join('\n');
      return `以下の問いについてあなたが書いたテキストに、Oryzaeの菌たちが反応を生成しました。\n\n${list}\n\n${JAR_URL}`;
    },
  },
  en: {
    subject: 'Your jar has fermented further',
    singleBody: (title) =>
      `Oryzae's microbes have responded to what you wrote about "${title}".\n${JAR_URL}`,
    multiBody: (titles) => {
      const list = titles.map((t) => `- ${t}`).join('\n');
      return `Oryzae's microbes have responded to what you wrote about the following questions:\n\n${list}\n\n${JAR_URL}`;
    },
  },
};

export class SendFermentationDigestUsecase {
  constructor(
    private emailNotifier: EmailNotifier,
    private resolveVerifiedEmail: (userId: string) => Promise<string | null>,
  ) {}

  async execute(params: {
    userId: string;
    questionTitles: string[];
    // 未指定時は 'ja' (#268 と同じデフォルト)。
    language?: FermentationLanguage;
  }): Promise<void> {
    const uniqueTitles = Array.from(
      new Set(params.questionTitles.map((t) => t.trim()).filter((t) => t.length > 0)),
    );
    if (uniqueTitles.length === 0) return;

    const email = await this.resolveVerifiedEmail(params.userId);
    if (!email) return;

    const language: FermentationLanguage = params.language ?? 'ja';
    const copy = COPY[language];
    const bodyText =
      uniqueTitles.length === 1 ? copy.singleBody(uniqueTitles[0]) : copy.multiBody(uniqueTitles);
    await this.emailNotifier.send({ to: email, subject: copy.subject, bodyText });
  }
}
