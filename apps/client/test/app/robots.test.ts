import { describe, expect, it } from 'vitest';
import robots from '@/app/robots';

describe('robots', () => {
  it('公開ルートを許可し sitemap を指す', () => {
    const r = robots();
    const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    expect(rule?.allow).toBe('/');
    expect(r.sitemap).toContain('/sitemap.xml');
  });

  it('保護下・認証・計測系を不許可にする', () => {
    const r = robots();
    const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    const disallow = rule?.disallow ?? [];
    const list = Array.isArray(disallow) ? disallow : [disallow];
    for (const path of ['/account', '/entries', '/api/', '/login']) {
      expect(list).toContain(path);
    }
  });
});
