import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it } from 'vitest';
import { DesktopOnlyOverlay } from '@/components/desktop-only-overlay';
import jaMessages from '@/i18n/messages/ja.json';

function renderWithI18n() {
  return render(
    <NextIntlClientProvider locale="ja" messages={jaMessages}>
      <DesktopOnlyOverlay />
    </NextIntlClientProvider>,
  );
}

describe('DesktopOnlyOverlay', () => {
  afterEach(() => cleanup());

  it('ja メッセージから heading と body を表示する', () => {
    renderWithI18n();
    expect(screen.getByText('デスクトップ専用です')).toBeDefined();
    expect(
      screen.getByText(
        /Oryzaeは現在、デスクトップブラウザ専用となっていてスマートフォンからはアクセスできません/,
      ),
    ).toBeDefined();
  });

  it('画面幅 < 768px かつ pointer:coarse のときだけ flex 表示になる', () => {
    const { container } = renderWithI18n();
    const root = container.firstElementChild;
    // デフォルトは hidden、media query 一致時のみ flex 表示。
    // PC (pointer: fine) でブラウザサイドバー等によって幅が 768px を下回るケースを除外するための判定式。
    expect(root?.className).toContain('hidden');
    expect(root?.className).toContain('[@media(max-width:767px)_and_(pointer:coarse)]:flex');
  });

  it('alert role を持ち aria-live が指定されている', () => {
    renderWithI18n();
    const alert = screen.getByRole('alert');
    expect(alert.getAttribute('aria-live')).toBe('polite');
  });
});
