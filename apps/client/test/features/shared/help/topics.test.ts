import { describe, expect, it } from 'vitest';
import { helpTextsFrom } from '@/features/shared/help/hooks/use-help-texts';
import {
  HELP_SECTIONS,
  HELP_TOPICS,
  helpTopic,
  isHelpTopicId,
  topicForScreen,
  topicForStudyLabel,
} from '@/features/shared/help/topics';
import enMessages from '@/i18n/messages/en.json';
import jaMessages from '@/i18n/messages/ja.json';
import koMessages from '@/i18n/messages/ko.json';
import zhMessages from '@/i18n/messages/zh.json';

const LOCALES = { ja: jaMessages, en: enMessages, zh: zhMessages, ko: koMessages };

describe('話題のカタログ', () => {
  it('識別子が重複しない', () => {
    const ids = HELP_TOPICS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('どの節にも話題がある（空の見出しを出さない）', () => {
    for (const section of HELP_SECTIONS) {
      expect(
        HELP_TOPICS.some((t) => t.section === section),
        section,
      ).toBe(true);
    }
  });

  it('「はじめに」は概念 → 問い → 書く → 漬ける の順（上から読めば一周する）', () => {
    expect(HELP_TOPICS.filter((t) => t.section === 'start').map((t) => t.id)).toEqual([
      'concept',
      'question',
      'write',
      'pickle',
    ]);
  });

  it('外へ出る話題は公開サイトの相対パスを持つ', () => {
    for (const topic of HELP_TOPICS.filter((t) => t.external)) {
      expect(topic.href?.startsWith('/')).toBe(true);
    }
  });

  it('全言語に、全話題の題・一言・本文・鍵語がある', () => {
    for (const [locale, messages] of Object.entries(LOCALES)) {
      const topics: Record<string, Record<string, string>> = messages.help.topics;
      for (const { id } of HELP_TOPICS) {
        for (const field of ['title', 'lead', 'body', 'keywords']) {
          expect(
            topics[id]?.[field]?.length ?? 0,
            `${locale}.help.topics.${id}.${field}`,
          ).toBeGreaterThan(0);
        }
      }
      // 使われない話題の文面も残さない（i18n の SSoT と食い違う）。
      expect(Object.keys(topics).sort()).toEqual(HELP_TOPICS.map((t) => t.id).sort());
    }
  });

  it('鍵語は区切って配列になる（全言語で 3 語以上）', () => {
    for (const [locale, messages] of Object.entries(LOCALES)) {
      const topics: Record<string, Record<string, string>> = messages.help.topics;
      const texts = helpTextsFrom((key) => {
        const [id, field] = key.split('.');
        return topics[id ?? '']?.[field ?? ''] ?? key;
      });
      for (const text of texts) {
        expect(text.keywords.length, `${locale}.${text.id}`).toBeGreaterThanOrEqual(3);
      }
    }
  });
});

describe('helpTopic / isHelpTopicId', () => {
  it('識別子から骨組みを引く', () => {
    expect(helpTopic('jar').href).toBe('/jar');
    expect(helpTopic('help').href).toBeNull();
  });

  it('知らない文字列は話題ではない（サーバーの返事や DOM 属性の門）', () => {
    expect(isHelpTopicId('jar')).toBe(true);
    expect(isHelpTopicId('billing')).toBe(false);
    expect(isHelpTopicId(null)).toBe(false);
    expect(isHelpTopicId(3)).toBe(false);
  });

  it('知らない識別子で引けば投げる', () => {
    // @ts-expect-error 存在しない識別子
    expect(() => helpTopic('billing')).toThrow();
  });
});

describe('topicForScreen', () => {
  it('画面ごとの話題', () => {
    expect(topicForScreen('/')).toBe('concept');
    expect(topicForScreen('/jar')).toBe('jar');
    expect(topicForScreen('/board')).toBe('board');
    expect(topicForScreen('/entries')).toBe('list');
    expect(topicForScreen('/entries/new')).toBe('write');
    expect(topicForScreen('/entries/abc')).toBe('write');
    expect(topicForScreen('/questions')).toBe('questions');
    expect(topicForScreen('/account')).toBe('account');
  });

  it('知らない画面は概念に落ちる', () => {
    expect(topicForScreen('/nowhere')).toBe('concept');
  });
});

describe('topicForStudyLabel', () => {
  it('書斎の物 → 話題。鉛筆は「書く」、手帳は物としての手帳', () => {
    expect(topicForStudyLabel('jar')).toBe('jar');
    expect(topicForStudyLabel('journal')).toBe('notebook');
    expect(topicForStudyLabel('board')).toBe('board');
    expect(topicForStudyLabel('archive')).toBe('archive');
    expect(topicForStudyLabel('pen')).toBe('write');
  });
});
