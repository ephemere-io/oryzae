import { localeSchema } from '@oryzae/shared';
import { describe, expect, it } from 'vitest';
import {
  isTranslatableLocale,
  NEWSLETTER_LOCALES,
  NEWSLETTER_SOURCE_LOCALE,
  resolveNewsletterLocale,
  TRANSLATABLE_LOCALES,
} from '@/contexts/newsletter/domain/models/newsletter-locale.js';

describe('NEWSLETTER_LOCALES', () => {
  // domain は @oryzae/shared を import できない（dep-cruiser）ので値を持ち直している。
  // ずれると「UI では選べるのに配信では無視される言語」が生まれる。
  it('アプリがサポートする言語（localeSchema）と一致する', () => {
    expect([...NEWSLETTER_LOCALES].sort()).toEqual([...localeSchema.options].sort());
  });

  it('翻訳対象は原文の言語を含まない', () => {
    expect(TRANSLATABLE_LOCALES).not.toContain(NEWSLETTER_SOURCE_LOCALE);
    expect([...TRANSLATABLE_LOCALES, NEWSLETTER_SOURCE_LOCALE].sort()).toEqual(
      [...NEWSLETTER_LOCALES].sort(),
    );
  });

  it('isTranslatableLocale が原文の言語だけ false', () => {
    expect(isTranslatableLocale('ja')).toBe(false);
    expect(isTranslatableLocale('en')).toBe(true);
    expect(isTranslatableLocale('zh')).toBe(true);
    expect(isTranslatableLocale('ko')).toBe(true);
  });
});

describe('resolveNewsletterLocale', () => {
  it('サポートしている言語はそのまま返す', () => {
    for (const locale of NEWSLETTER_LOCALES) {
      expect(resolveNewsletterLocale(locale)).toBe(locale);
    }
  });

  // 英語に倒すと、言語を設定していない日本語話者へ急に英語が飛ぶ。
  // 判別できないときは翻訳を挟まない＝運営者が書いたものをそのまま届ける。
  it('未設定・想定外の値は原文の言語に倒す', () => {
    for (const raw of [undefined, null, '', 'fr', 'ja-JP', 'EN', 42, {}, []]) {
      expect(resolveNewsletterLocale(raw)).toBe(NEWSLETTER_SOURCE_LOCALE);
    }
  });
});
