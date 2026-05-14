import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LinkQuestionNudgeModal } from '@/features/entries/components/link-question-nudge-modal';
import jaMessages from '@/i18n/messages/ja.json';

describe('LinkQuestionNudgeModal (Issue #316)', () => {
  afterEach(() => cleanup());

  function setup(open: boolean) {
    const onClose = vi.fn();
    render(
      <NextIntlClientProvider locale="ja" messages={jaMessages}>
        <LinkQuestionNudgeModal open={open} onClose={onClose} />
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
    expect(screen.getByText('問いを紐付けてみませんか')).toBeTruthy();
    expect(screen.getByText(/エントリに問いを紐付けると/)).toBeTruthy();
    expect(screen.getByText('わかりました')).toBeTruthy();
  });

  it('「わかりました」で onClose を呼ぶ', () => {
    const { onClose } = setup(true);
    fireEvent.click(screen.getByText('わかりました'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
