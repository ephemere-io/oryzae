import { describe, expect, it } from 'vitest';
import { __INTERNAL } from '@/contexts/newsletter/infrastructure/llm/vercel-ai-newsletter-translator.gateway.js';

const { buildPrompt } = __INTERNAL;

const source = {
  subject: '今月の更新',
  bodyMarkdown:
    '## 新機能\n\n- 書斎ができました\n\n詳しくは [こちら](https://oryzae.ephemere.io/support)。',
};

describe('buildPrompt', () => {
  it('原文の件名と本文をそのまま渡す', () => {
    const prompt = buildPrompt({ ...source, targetLocale: 'en' });

    expect(prompt).toContain('今月の更新');
    expect(prompt).toContain('- 書斎ができました');
    expect(prompt).toContain('https://oryzae.ephemere.io/support');
  });

  it('言語を名前で指示する（コードだけだと取り違えられる）', () => {
    expect(buildPrompt({ ...source, targetLocale: 'en' })).toContain('English');
    expect(buildPrompt({ ...source, targetLocale: 'zh' })).toContain('简体中文');
    expect(buildPrompt({ ...source, targetLocale: 'ko' })).toContain('한국어');
  });

  // 構造が変わると、日本語版と他言語版が別のメールになる。
  it('Markdown の構造を保つよう指示する', () => {
    const prompt = buildPrompt({ ...source, targetLocale: 'en' });

    expect(prompt).toContain('Preserve the Markdown structure exactly');
    expect(prompt).toContain('The same number of');
  });

  // リンク先が訳されると、存在しない URL に飛ばすことになる。
  it('URL をそのまま保つよう指示する', () => {
    const prompt = buildPrompt({ ...source, targetLocale: 'en' });

    expect(prompt).toContain('Keep every URL byte-for-byte');
    expect(prompt).toContain('Translate the link text, never the address');
  });

  // 訳した結果が renderNewsletterHtml に通らないと、素の文字として届く。
  it('レンダラが解釈できない記法を禁じる', () => {
    const prompt = buildPrompt({ ...source, targetLocale: 'en' });
    expect(prompt).toContain('Do not introduce tables, images, code blocks, or HTML');
  });

  // 原文に無い事実が翻訳で生えると、言語によって内容が違うお知らせになる。
  it('事実を足さない・弱めないよう指示する', () => {
    const prompt = buildPrompt({ ...source, targetLocale: 'en' });
    expect(prompt).toContain('Do not add, remove, or soften any factual claim');
  });

  // 配信停止の文言は言語ごとの固定文で、翻訳事故で意味が変わると直接害になる。
  it('フッターと配信停止は訳させない', () => {
    const prompt = buildPrompt({ ...source, targetLocale: 'en' });
    expect(prompt).toContain('Do not translate or restate the footer or the unsubscribe notice');
  });
});
