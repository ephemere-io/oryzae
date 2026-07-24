import { describe, expect, it } from 'vitest';
import { buildLandingJsonLd } from '@/features/landing/components/landing-structured-data';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function graph(json: Record<string, unknown>): Record<string, unknown>[] {
  const g = json['@graph'];
  return Array.isArray(g) ? g.filter(isRecord) : [];
}

describe('buildLandingJsonLd', () => {
  const json = buildLandingJsonLd({
    url: 'https://oryzae.example',
    locale: 'ja',
    description: '説明文',
    faq: [
      { question: 'Q1', answer: 'A1' },
      { question: 'Q2', answer: 'A2' },
    ],
  });

  it('schema.org コンテキストと @graph を持つ', () => {
    expect(json['@context']).toBe('https://schema.org');
    expect(graph(json).length).toBeGreaterThan(0);
  });

  it('Organization / WebSite / WebApplication / FAQPage を含む', () => {
    const types = graph(json).map((n) => n['@type']);
    expect(types).toContain('Organization');
    expect(types).toContain('WebSite');
    expect(types).toContain('WebApplication');
    expect(types).toContain('FAQPage');
  });

  it('FAQPage は渡した Q&A の数だけ mainEntity を持ち、内容を含む', () => {
    const faqNode = graph(json).find((n) => n['@type'] === 'FAQPage');
    const entities = faqNode?.mainEntity;
    expect(Array.isArray(entities)).toBe(true);
    expect(Array.isArray(entities) ? entities.length : -1).toBe(2);

    const serialized = JSON.stringify(json);
    expect(serialized).toContain('Q1');
    expect(serialized).toContain('A1');
    expect(serialized).toContain('Question');
    expect(serialized).toContain('acceptedAnswer');
  });
});
