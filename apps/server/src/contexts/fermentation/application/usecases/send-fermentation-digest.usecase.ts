import type { EmailNotifier } from '../../domain/gateways/email-notifier.gateway.js';

const SUBJECT = 'あなたの瓶の発酵が進みました';
const JAR_URL = 'https://oryzae-client.vercel.app/jar';

export class SendFermentationDigestUsecase {
  constructor(
    private emailNotifier: EmailNotifier,
    private resolveVerifiedEmail: (userId: string) => Promise<string | null>,
  ) {}

  async execute(params: { userId: string; questionTitles: string[] }): Promise<void> {
    const uniqueTitles = Array.from(
      new Set(params.questionTitles.map((t) => t.trim()).filter((t) => t.length > 0)),
    );
    if (uniqueTitles.length === 0) return;

    const email = await this.resolveVerifiedEmail(params.userId);
    if (!email) return;

    const bodyText = composeBody(uniqueTitles);
    await this.emailNotifier.send({ to: email, subject: SUBJECT, bodyText });
  }
}

function composeBody(titles: string[]): string {
  if (titles.length === 1) {
    return `${titles[0]}についてあなたが書いたテキストに、Oryzaeの菌たちが反応を生成しました。\n${JAR_URL}`;
  }
  const list = titles.map((t) => `・${t}`).join('\n');
  return `以下の問いについてあなたが書いたテキストに、Oryzaeの菌たちが反応を生成しました。\n\n${list}\n\n${JAR_URL}`;
}
