import type { Newsletter } from '../models/newsletter.js';

export interface NewsletterRepositoryGateway {
  findById(id: string): Promise<Newsletter | null>;
  /** 新しい順。一覧画面はページングせず直近だけを出す（運営が書く本数は多くない）。 */
  listRecent(limit: number): Promise<Newsletter[]>;
  /** 直近に送信し終えた配信。LLM 下書きの「前回配信から」の起点に使う。 */
  findLastSent(): Promise<Newsletter | null>;
  save(newsletter: Newsletter): Promise<void>;
  delete(id: string): Promise<void>;
}
