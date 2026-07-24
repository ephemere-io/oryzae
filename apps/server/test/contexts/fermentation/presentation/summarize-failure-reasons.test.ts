import { describe, expect, it } from 'vitest';
import { summarizeFailureReasons } from '@/contexts/fermentation/presentation/summarize-failure-reasons.js';

describe('summarizeFailureReasons', () => {
  it('returns empty string for no errors', () => {
    expect(summarizeFailureReasons([])).toBe('');
  });

  it('shows a single reason without a count prefix', () => {
    expect(summarizeFailureReasons([{ error: 'boom' }])).toBe('boom');
  });

  it('collapses identical messages into one `N× ` line', () => {
    const errors = Array.from({ length: 7 }, () => ({
      error: 'model: claude-sonnet-4-20250514',
    }));
    expect(summarizeFailureReasons(errors)).toBe('7× model: claude-sonnet-4-20250514');
  });

  it('orders reasons by descending count', () => {
    const errors = [
      { error: 'rare' },
      { error: 'common' },
      { error: 'common' },
      { error: 'common' },
    ];
    expect(summarizeFailureReasons(errors)).toBe('3× common\nrare');
  });

  it('normalizes whitespace and newlines so each reason is one line', () => {
    expect(summarizeFailureReasons([{ error: 'line1\n  line2\t line3' }])).toBe(
      'line1 line2 line3',
    );
  });

  it('falls back to a placeholder for blank messages', () => {
    expect(summarizeFailureReasons([{ error: '   ' }])).toBe('(理由不明)');
  });

  it('stays within the char budget and truncates with a remainder marker', () => {
    // 50 distinct long messages — must not blow past the Discord field limit.
    const errors = Array.from({ length: 50 }, (_, i) => ({
      error: `error-${i}-${'x'.repeat(80)}`,
    }));
    const result = summarizeFailureReasons(errors, 1000);
    expect(result.length).toBeLessThanOrEqual(1000);
    expect(result).toMatch(/…他 \d+ 種類$/);
  });

  it('truncates a single over-long message rather than dropping it', () => {
    const result = summarizeFailureReasons([{ error: 'y'.repeat(5000) }], 1000);
    expect(result.length).toBeLessThanOrEqual(1000);
    expect(result.endsWith('…')).toBe(true);
  });

  it('handles the mass-retire scenario (many identical) as one short line', () => {
    const errors = Array.from({ length: 200 }, () => ({ error: 'model: foo (not_found)' }));
    const result = summarizeFailureReasons(errors);
    expect(result).toBe('200× model: foo (not_found)');
    expect(result.length).toBeLessThanOrEqual(1000);
  });
});
