import type { EmailNotifier } from '../../domain/gateways/email-notifier.gateway.js';
import type { FermentationLanguage } from '../../domain/services/fermentation-eligibility.service.js';

// issue #290 フォロー: 「emailSent=true なのに実際は送られていない」事故を
// 防ぐため、execute() は「送った / なぜ送らなかったか」を返す。
// 呼び出し側 (cron / admin /fire / retry) はこの情報をログ・レスポンスに使う。
//
// reason の意味:
// - 'no-titles': dedupe 後に問いタイトルが 0 件 (普通は呼び出し側で防ぐ)
// - 'no-verified-email': 解決した email が null (Supabase Auth で email_confirmed_at 未設定 等)
// - 'disabled': EMAIL_ENABLED=false (dev 環境向け)
// - 'no-api-key': RESEND_API_KEY 未設定 (本番環境ミス検知用)
type DigestSendResult =
  | { sent: true }
  | { sent: false; reason: 'no-titles' | 'no-verified-email' | 'disabled' | 'no-api-key' };

// メール内リンクは本番ドメイン (LP / アプリ本体) を指す。preview / dev で
// 送信したメールでも、受信者は常に本番に着地する想定 (vercel.app の preview
// URL は受信者にとって意味がないため)。
const JAR_URL = 'https://oryzae.ephemere.io/jar';

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
  }): Promise<DigestSendResult> {
    const uniqueTitles = Array.from(
      new Set(params.questionTitles.map((t) => t.trim()).filter((t) => t.length > 0)),
    );
    if (uniqueTitles.length === 0) return { sent: false, reason: 'no-titles' };

    const email = await this.resolveVerifiedEmail(params.userId);
    if (!email) {
      // 未検証メール / メール未登録ユーザーはサイレントスキップで構わないが、
      // サポート問い合わせで切り分けられるよう warn だけ残す (issue #288)。
      console.warn('[SendFermentationDigestUsecase] skipped — verified email not found', {
        userId: params.userId,
        titleCount: uniqueTitles.length,
      });
      return { sent: false, reason: 'no-verified-email' };
    }

    const language: FermentationLanguage = params.language ?? 'ja';
    const copy = COPY[language];
    const bodyText =
      uniqueTitles.length === 1 ? copy.singleBody(uniqueTitles[0]) : copy.multiBody(uniqueTitles);
    return await this.emailNotifier.send({ to: email, subject: copy.subject, bodyText });
  }
}
