import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  type UnsubscribeTokenGateway,
  UnsubscribeTokenUnavailableError,
} from '../../domain/gateways/unsubscribe-token.gateway.js';

/**
 * `<base64url(userId)>.<base64url(HMAC-SHA256)>` 形式のトークン。
 *
 * ## 用途を署名に混ぜる
 *
 * 署名対象は user_id そのものではなく `newsletter-unsubscribe:v1:<userId>`。
 * 同じ秘密鍵を将来ほかの用途（例: ログインリンク）にも使ったとき、片方の
 * トークンをもう片方に持ち込めないようにするため。
 *
 * ## 有効期限を付けない
 *
 * 配信停止リンクは「半年前のメールを掘り出して押す」ことが普通にある。
 * 期限切れで押せないリンクは、止める口が無いのと同じ。期限の代わりに
 * **押しても失うものが無い**（配信の可否が変わるだけで、アカウントには
 * 触れない）ようにしてある。
 */
export class HmacUnsubscribeToken implements UnsubscribeTokenGateway {
  private static readonly PURPOSE = 'newsletter-unsubscribe:v1';

  private secret(): string {
    const secret = process.env.NEWSLETTER_UNSUBSCRIBE_SECRET;
    if (!secret) {
      throw new UnsubscribeTokenUnavailableError(
        'NEWSLETTER_UNSUBSCRIBE_SECRET が未設定です。配信停止リンクを作れないため送信できません。',
      );
    }
    return secret;
  }

  private sign(userId: string, secret: string): string {
    return createHmac('sha256', secret)
      .update(`${HmacUnsubscribeToken.PURPOSE}:${userId}`)
      .digest('base64url');
  }

  issue(userId: string): string {
    const payload = Buffer.from(userId, 'utf8').toString('base64url');
    return `${payload}.${this.sign(userId, this.secret())}`;
  }

  verify(token: string): string | null {
    // 鍵が無い環境では検証もできない。例外にせず「不正なトークン」として扱う
    // （公開エンドポイントなので、設定状況を応答から読み取らせない）。
    let secret: string;
    try {
      secret = this.secret();
    } catch {
      return null;
    }

    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [payload, signature] = parts;
    if (!payload || !signature) return null;

    let userId: string;
    try {
      userId = Buffer.from(payload, 'base64url').toString('utf8');
    } catch {
      return null;
    }
    if (userId.length === 0) return null;

    const expected = Buffer.from(this.sign(userId, secret), 'utf8');
    const actual = Buffer.from(signature, 'utf8');
    // 長さが違うと timingSafeEqual が投げるので、先に弾く。
    if (expected.length !== actual.length) return null;
    if (!timingSafeEqual(expected, actual)) return null;

    return userId;
  }
}
