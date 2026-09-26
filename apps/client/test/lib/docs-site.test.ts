import { describe, expect, it } from 'vitest';
import { DOCS_SITE_URL, docsHref } from '@/lib/docs-site';

describe('docsHref — 公開サイト（別ドメイン）への導線', () => {
  it('相対パスを公開サイトの絶対 URL にする', () => {
    expect(docsHref('/support')).toBe(`${DOCS_SITE_URL}/support`);
    expect(docsHref('/support')).toMatch(/^https?:\/\//);
  });

  it('言語を渡すと ?lang= で添える（向こうはブラウザの言語で開いてしまうため）', () => {
    // 英語の OS で日本語のアプリを使っている人が、ヘルプだけ英語で開いた（実機で報告）。
    expect(docsHref('/support', 'ja')).toBe(`${DOCS_SITE_URL}/support?lang=ja`);
    expect(docsHref('/', 'en')).toBe(`${DOCS_SITE_URL}/?lang=en`);
  });

  it('#fragment は query の後ろに置く（前に置くと lang が fragment に食われる）', () => {
    expect(docsHref('/support#contact', 'ja')).toBe(`${DOCS_SITE_URL}/support?lang=ja#contact`);
  });

  it('既に query があれば & でつなぐ', () => {
    expect(docsHref('/support?x=1', 'ko')).toBe(`${DOCS_SITE_URL}/support?x=1&lang=ko`);
  });

  it('言語が無ければそのまま', () => {
    expect(docsHref('/privacy', undefined)).toBe(`${DOCS_SITE_URL}/privacy`);
    expect(docsHref('/privacy', '')).toBe(`${DOCS_SITE_URL}/privacy`);
  });
});
