import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import jaMessages from '@/i18n/messages/ja.json';

// `getTranslations` は next-intl/server から提供される async API。
// jsdom 環境では next/headers などに依存して動かないので、ja メッセージから直接引くようスタブする。
vi.mock('next-intl/server', () => ({
  getTranslations: async (namespace: string) => {
    return (key: string) => {
      const parts = `${namespace}.${key}`.split('.');
      let cur: unknown = jaMessages;
      for (const part of parts) {
        if (typeof cur !== 'object' || cur === null) return '';
        cur = (cur as Record<string, unknown>)[part];
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

  it('md:hidden クラスで md 以上では非表示になる (Tailwind 命名規約の保証)', async () => {
    const ui = await DesktopOnlyOverlay();
    const { container } = render(ui);
    const root = container.firstElementChild;
    expect(root?.className).toContain('md:hidden');
  });

  it('alert role を持ち aria-live が指定されている', async () => {
    const ui = await DesktopOnlyOverlay();
    render(ui);
    const alert = screen.getByRole('alert');
    expect(alert.getAttribute('aria-live')).toBe('polite');
  });
});
