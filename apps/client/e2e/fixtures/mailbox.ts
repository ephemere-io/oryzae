import { expect } from '@playwright/test';

/**
 * ローカル Supabase に同梱の inbucket（メール受信箱）から確認メールを読む。
 *
 * 「サインアップ → 確認メール → リンク → ログイン」は実際のメール受信を伴うため、
 * これまで自動テストに載せられず**新規登録の経路がまるごと未検証**だった。
 * 使い捨てインスタンスには受信箱が付いてくるので、ここを通せるようにする。
 *
 * 本番でしか動かない Google OAuth と違い、メール確認は完全にローカルで再現できる。
 */

const INBUCKET = process.env.INBUCKET_URL ?? 'http://127.0.0.1:54324';

interface InbucketMessage {
  id: string;
  subject: string;
}

/**
 * inbucket のメールボックス名はアドレスのローカル部（@ の前）を小文字にしたもの。
 *
 * 注意: `foo+tag@…` のようなプラスタグ付きは inbucket 側の扱いが実装依存なので、
 * このヘルパーではタグを落とさない（＝タグ付きアドレスは未検証）。
 * E2E で使うアドレスはタグ無しにすること。
 */
function mailboxOf(email: string): string {
  return email.split('@')[0].toLowerCase();
}

/** 受信箱のレスポンスは信用せず、要素ごとに形を確かめる（as は使わない）。 */
function isInbucketMessage(value: unknown): value is InbucketMessage {
  if (typeof value !== 'object' || value === null) return false;
  if (!('id' in value) || typeof value.id !== 'string') return false;
  return 'subject' in value && typeof value.subject === 'string';
}

/**
 * 受信箱に到達できないこと自体を、メール未着と区別して落とす。
 *
 * ここを黙って空配列にすると、INBUCKET_URL の設定ミスが「30秒待って
 * メールが来なかった」という誤った症状として現れ、原因追跡が遠回りになる。
 */
async function listMessages(email: string): Promise<InbucketMessage[]> {
  const url = `${INBUCKET}/api/v1/mailbox/${encodeURIComponent(mailboxOf(email))}`;
  let res: Response;
  try {
    res = await fetch(url);
  } catch (cause) {
    throw new Error(`受信箱に接続できない: ${url}（INBUCKET_URL の設定を確認）`, { cause });
  }
  // 未作成のメールボックスは 404 を返す＝「まだ届いていない」なので待つ。
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`受信箱が ${res.status} を返した: ${url}`);
  const body: unknown = await res.json();
  return Array.isArray(body) ? body.filter(isInbucketMessage) : [];
}

/** 届くまで待って、最新1通の本文（text + html）を返す。 */
export async function waitForLatestEmail(email: string, timeoutMs = 30_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  let last: InbucketMessage | undefined;
  while (Date.now() < deadline) {
    const messages = await listMessages(email);
    last = messages.at(-1);
    if (last) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  if (!last) {
    throw new Error(`${email} 宛のメールが ${timeoutMs}ms 以内に届かなかった`);
  }

  const res = await fetch(
    `${INBUCKET}/api/v1/mailbox/${encodeURIComponent(mailboxOf(email))}/${last.id}`,
  );
  const body: unknown = await res.json();
  if (typeof body !== 'object' || body === null || !('body' in body)) return '';
  const inner = body.body;
  if (typeof inner !== 'object' || inner === null) return '';
  const text = 'text' in inner && typeof inner.text === 'string' ? inner.text : '';
  const html = 'html' in inner && typeof inner.html === 'string' ? inner.html : '';
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
  const m = mailBody.match(/[?&]token=([A-Za-z0-9_-]+)/);
  expect(m, `確認メールから token を取り出せなかった:\n${mailBody.slice(0, 400)}`).not.toBeNull();
  return m ? m[1] : '';
}
