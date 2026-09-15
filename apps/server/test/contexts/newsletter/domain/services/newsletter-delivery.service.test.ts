import { describe, expect, it } from 'vitest';
import type { NewsletterTranslation } from '@/contexts/newsletter/domain/gateways/newsletter-translation-repository.gateway.js';
import {
  isTranslationFresh,
  missingTranslationLocales,
  resolveLocalizedContent,
} from '@/contexts/newsletter/domain/services/newsletter-delivery.service.js';

const source = { subject: '今月の更新', bodyMarkdown: '本文です。' };

const en: NewsletterTranslation = {
  locale: 'en',
  subject: 'This month',
  bodyMarkdown: 'Body in English.',
  sourceSubject: source.subject,
  sourceBodyMarkdown: source.bodyMarkdown,
  updatedAt: '2026-09-15T00:00:00.000Z',
};

describe('isTranslationFresh', () => {
  it('件名も本文も一致していれば最新', () => {
    expect(isTranslationFresh(en, source)).toBe(true);
  });

  // フラグではなく原文そのものを控えている理由がこれ。
  it('本文を書き換えたら古い', () => {
    expect(isTranslationFresh(en, { ...source, bodyMarkdown: '書き換えた' })).toBe(false);
  });

  it('件名を書き換えても古い', () => {
    expect(isTranslationFresh(en, { ...source, subject: '差し替え' })).toBe(false);
  });
});

describe('resolveLocalizedContent', () => {
  it('日本語は翻訳を見ずに原文を返す', () => {
    expect(resolveLocalizedContent('ja', source, [])).toEqual({
      locale: 'ja',
      subject: '今月の更新',
      bodyMarkdown: '本文です。',
    });
  });

  it('翻訳があればその言語の文面を返す', () => {
    expect(resolveLocalizedContent('en', source, [en])).toEqual({
      locale: 'en',
      subject: 'This month',
      bodyMarkdown: 'Body in English.',
    });
  });

  // ここでフォールバックすると「英語のつもりが日本語で届いた」が黙って起きる。
  it('翻訳が無ければ null（原文に落とさない）', () => {
    expect(resolveLocalizedContent('en', source, [])).toBeNull();
  });

  it('翻訳が古ければ null', () => {
    const stale = { ...en, sourceBodyMarkdown: '前の本文' };
    expect(resolveLocalizedContent('en', source, [stale])).toBeNull();
  });

  it('別の言語の翻訳は使わない', () => {
    expect(resolveLocalizedContent('zh', source, [en])).toBeNull();
  });
});

describe('missingTranslationLocales', () => {
  it('宛先がいて翻訳が無い言語を返す', () => {
    expect(missingTranslationLocales({ ja: 94, en: 7, zh: 1, ko: 0 }, source, [])).toEqual([
      'en',
      'zh',
    ]);
  });

  // 誰も読まない翻訳に LLM の費用を払い続けないため。
  it('宛先が 0 名の言語は求めない', () => {
    expect(missingTranslationLocales({ ja: 94, en: 0, zh: 0, ko: 0 }, source, [])).toEqual([]);
  });

  it('日本語は翻訳の対象にしない（原文なので）', () => {
    expect(missingTranslationLocales({ ja: 94, en: 0, zh: 0, ko: 0 }, source, [])).not.toContain(
      'ja',
    );
  });

  it('揃っていれば空', () => {
    expect(missingTranslationLocales({ ja: 94, en: 7, zh: 0, ko: 0 }, source, [en])).toEqual([]);
  });

  it('古い翻訳は「無い」と同じ扱い', () => {
    const stale = { ...en, sourceSubject: '前の件名' };
    expect(missingTranslationLocales({ ja: 94, en: 7, zh: 0, ko: 0 }, source, [stale])).toEqual([
      'en',
    ]);
  });
});
