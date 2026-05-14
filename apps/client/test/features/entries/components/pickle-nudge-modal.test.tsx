import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PickleNudgeModal } from '@/features/entries/components/pickle-nudge-modal';
import jaMessages from '@/i18n/messages/ja.json';

describe('PickleNudgeModal (Issue #316)', () => {
  afterEach(() => cleanup());

  function setup(open: boolean) {
    const onClose = vi.fn();
    render(
      <NextIntlClientProvider locale="ja" messages={jaMessages}>
        <PickleNudgeModal open={open} onClose={onClose} />
      </NextIntlClientProvider>,
    );
    return { onClose };
  }

  it('open=false なら描画しない', () => {
    setup(false);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('open=true で見出し / 本文 / dismiss を表示する', () => {
    setup(true);
    expect(screen.getByText('漬け込んでみませんか')).toBeTruthy();
    expect(screen.getByText(/問いの紐付いたエントリは/)).toBeTruthy();
    expect(screen.getByText('わかりました')).toBeTruthy();
  });

  it('「わかりました」で onClose を呼ぶ', () => {
    const { onClose } = setup(true);
    fireEvent.click(screen.getByText('わかりました'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
