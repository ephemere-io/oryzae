/**
 * ローカル Supabase に同梱のメール受信箱から確認メールを読む。
 *
 * 「サインアップ → 確認メール → リンク → ログイン」は実際のメール受信を伴うため、
 * これまで自動テストに載せられず**新規登録の経路がまるごと未検証**だった。
 * 使い捨てインスタンスには受信箱が付いてくるので、ここを通せるようにする。
 *
 * 本番でしか動かない Google OAuth と違い、メール確認は完全にローカルで再現できる。
 *
 * **受信箱の実体は Mailpit**（config.toml の `[local_smtp]`）。
 * 以前の Supabase CLI は Inbucket を使っており設定キーも `[inbucket]` だったが、
 * 現行 CLI では `[local_smtp]` + Mailpit に置き換わっている。両者は API が別物で、
 * Inbucket 時代の `/api/v1/mailbox/{名前}` は Mailpit には無い。
 * API 仕様: https://mailpit.axllent.org
 */

const MAILPIT = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324';

/** `/api/v1/search` の messages 要素（必要な分だけ）。Mailpit の項目名は PascalCase。 */
interface MailpitSummary {
  ID: string;
  Created: string;
}

/** 受信箱のレスポンスは信用せず、要素ごとに形を確かめる（`as` は使わない）。 */
function isMailpitSummary(value: unknown): value is MailpitSummary {
  if (typeof value !== 'object' || value === null) return false;
  if (!('ID' in value) || typeof value.ID !== 'string') return false;
  return 'Created' in value && typeof value.Created === 'string';
}

/**
 * 受信箱に到達できないこと自体を、メール未着と区別して落とす。
 *
 * ここを黙って空配列にすると、MAILPIT_URL の設定ミスや受信箱の無効化が
 * 「30 秒待ってメールが来なかった」という誤った症状として現れ、原因追跡が遠回りになる。
 */
async function search(email: string): Promise<MailpitSummary[]> {
  // Mailpit の検索構文。宛先で絞る。
  const url = `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`;
  let res: Response;
  try {
    res = await fetch(url);
  } catch (cause) {
    throw new Error(`受信箱に接続できない: ${url}（MAILPIT_URL と [local_smtp] を確認）`, {
      cause,
    });
  }
  if (!res.ok) throw new Error(`受信箱が ${res.status} を返した: ${url}`);

  const body: unknown = await res.json();
  if (typeof body !== 'object' || body === null || !('messages' in body)) return [];
  const messages = body.messages;
  return Array.isArray(messages) ? messages.filter(isMailpitSummary) : [];
}

/** 届くまで待って、最新 1 通の本文（text + html）を返す。 */
export async function waitForLatestEmail(email: string, timeoutMs = 30_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  let newest: MailpitSummary | undefined;

  while (Date.now() < deadline) {
    const messages = await search(email);
    // Mailpit は新しい順で返すが、順序に依存せず Created で選ぶ。
    newest = messages.reduce<MailpitSummary | undefined>(
      (best, m) => (!best || m.Created > best.Created ? m : best),
      undefined,
    );
    if (newest) break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  if (!newest) {
    throw new Error(`${email} 宛のメールが ${timeoutMs}ms 以内に届かなかった`);
  }

  const res = await fetch(`${MAILPIT}/api/v1/message/${encodeURIComponent(newest.ID)}`);
  if (!res.ok) throw new Error(`メール本文の取得に失敗: ${res.status}`);

  const body: unknown = await res.json();
  if (typeof body !== 'object' || body === null) return '';
  const text = 'Text' in body && typeof body.Text === 'string' ? body.Text : '';
  const html = 'HTML' in body && typeof body.HTML === 'string' ? body.HTML : '';
  return `${text}\n${html}`;
}

/**
 * 確認メールから token_hash を取り出す。
 *
 * Supabase 既定テンプレートの `{{ .ConfirmationURL }}` は
 * `{SUPABASE_URL}/auth/v1/verify?token=<token_hash>&type=signup&redirect_to=...`
 * の形。アプリは自社ドメインに寄せた `/auth/confirm?token_hash=...` を使うので、
 * ここで token を取り出してそちらへ渡す。
 */
export function extractTokenHash(mailBody: string): string {
  const matched = mailBody.match(/[?&]token=([A-Za-z0-9_-]+)/);
  if (!matched) {
    // ここに来るのは「メールは届いたが中身が想定と違う」ケース。
    // テンプレート変更や redirect_to の形が変わったときに、本文の頭を添えて落とす。
    throw new Error(`確認メールから token を取り出せなかった:\n${mailBody.slice(0, 400)}`);
  }
  return matched[1];
}
