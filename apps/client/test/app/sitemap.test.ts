import { describe, expect, it } from 'vitest';
import sitemap from '@/app/sitemap';

describe('sitemap', () => {
  it('公開ページのみを含む', () => {
    const urls = sitemap().map((e) => e.url);
    expect(urls.some((u) => u.endsWith('/'))).toBe(true);
    expect(urls.some((u) => u.endsWith('/privacy'))).toBe(true);
    expect(urls.some((u) => u.endsWith('/support'))).toBe(true);
    // 保護ページは載せない
    expect(urls.some((u) => u.includes('/account') || u.includes('/entries'))).toBe(false);
  });

  it('トップを最優先にする', () => {
    const top = sitemap().find((e) => e.url.endsWith('/'));
    expect(top?.priority).toBe(1);
  });
});
