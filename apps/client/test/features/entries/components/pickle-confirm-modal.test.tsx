import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PickleConfirmModal } from '@/features/entries/components/pickle-confirm-modal';
import jaMessages from '@/i18n/messages/ja.json';

describe('PickleConfirmModal (Issue #316)', () => {
  afterEach(() => cleanup());

  function setup(overrides: { open?: boolean; saving?: boolean } = {}) {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    const utils = render(
      <NextIntlClientProvider locale="ja" messages={jaMessages}>
        <PickleConfirmModal
          open={overrides.open ?? true}
          saving={overrides.saving ?? false}
          title="今日の発見"
          linkedQuestionTexts={['何が嬉しかった?']}
          onConfirm={onConfirm}
          onClose={onClose}
        />
      </NextIntlClientProvider>,
    );
    return { onConfirm, onClose, utils };
  }

  it('open=false なら何も描画しない', () => {
    setup({ open: false });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('open=true で見出し / タイトル / 紐付き問いを表示する', () => {
    setup();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('このエントリを瓶に漬け込む')).toBeTruthy();
    // body にタイトルが埋め込まれている
    expect(screen.getByText(/今日の発見/)).toBeTruthy();
    // 紐付き問いがチップで表示される
    expect(screen.getByText('何が嬉しかった?')).toBeTruthy();
  });

  it('「漬け込む」ボタンで onConfirm を呼ぶ', () => {
    const { onConfirm } = setup();
    fireEvent.click(screen.getByText('漬け込む'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('saving=true の間は確認ボタンが disabled になり saving 文言を出す', () => {
    setup({ saving: true });
    const button = screen.getByText('漬け込み中...').closest('button') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('「キャンセル」で onClose を呼ぶ', () => {
    const { onClose } = setup();
    fireEvent.click(screen.getByText('キャンセル'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
