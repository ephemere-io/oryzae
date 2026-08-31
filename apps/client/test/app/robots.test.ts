import { describe, expect, it } from 'vitest';
import robots from '@/app/robots';

describe('robots', () => {
  it('全ルートのクロールを拒否する', () => {
    // このアプリは全ページ非公開。公開ページ（LP・/support・/privacy）は別リポジトリの
    // 公開サイトが持つ。ここに allow が現れたら、公開すべきでないページが
    // インデックスされる合図。
    const r = robots();
    const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    expect(rule?.disallow).toBe('/');
    expect(rule?.allow).toBeUndefined();
  });

  it('sitemap を出さない（公開サイト側が持つ）', () => {
    expect(robots().sitemap).toBeUndefined();
  });
});
