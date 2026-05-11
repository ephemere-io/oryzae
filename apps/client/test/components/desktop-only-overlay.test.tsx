import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import jaMessages from '@/i18n/messages/ja.json';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// `getTranslations` は next-intl/server から提供される async API。
// jsdom 環境では next/headers などに依存して動かないので、ja メッセージから直接引くようスタブする。
vi.mock('next-intl/server', () => ({
  getTranslations: async (namespace: string) => {
    return (key: string) => {
      const parts = `${namespace}.${key}`.split('.');
      let cur: unknown = jaMessages;
      for (const part of parts) {
        if (!isRecord(cur)) return '';
        cur = cur[part];
      }
      return typeof cur === 'string' ? cur : '';
    };
  },
}));

import { DesktopOnlyOverlay } from '@/components/desktop-only-overlay';

describe('DesktopOnlyOverlay', () => {
  afterEach(() => cleanup());

  it('ja メッセージから heading と body を表示する', async () => {
    // server component は async なので await してから render に渡す
    const ui = await DesktopOnlyOverlay();
    render(ui);
    expect(screen.getByText('デスクトップ専用です')).toBeDefined();
    expect(
      screen.getByText(
        /Oryzaeは現在、デスクトップブラウザ専用となっていてスマートフォンからはアクセスできません/,
      ),
    ).toBeDefined();
  });

  it('画面幅 < 768px かつ pointer:coarse のときだけ flex 表示になる', async () => {
    const ui = await DesktopOnlyOverlay();
    const { container } = render(ui);
    const root = container.firstElementChild;
    // デフォルトは hidden、media query 一致時のみ flex 表示。
    // PC (pointer: fine) でブラウザサイドバー等によって幅が 768px を下回るケースを除外するための判定式。
    expect(root?.className).toContain('hidden');
    expect(root?.className).toContain('[@media(max-width:767px)_and_(pointer:coarse)]:flex');
  });

  it('alert role を持ち aria-live が指定されている', async () => {
    const ui = await DesktopOnlyOverlay();
    render(ui);
    const alert = screen.getByRole('alert');
    expect(alert.getAttribute('aria-live')).toBe('polite');
  });
});
