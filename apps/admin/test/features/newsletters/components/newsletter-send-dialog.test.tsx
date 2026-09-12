import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NewsletterSendDialog } from '@/features/newsletters/components/newsletter-send-dialog';
import type { NewsletterPreview } from '@/features/newsletters/types';

// vitest の globals を切ってあるので自動 cleanup が走らない。
// 明示しないと Dialog の portal が document.body に残り、次のテストで二重に見つかる。
afterEach(cleanup);

const preview: NewsletterPreview = {
  id: 'nl-1',
  subject: '今月の更新',
  html: '<html><body><p>本文です。</p></body></html>',
  text: '今月の更新\n\n本文です。',
  recipientCount: 137,
  sendable: true,
};

function renderDialog(overrides?: {
  preview?: NewsletterPreview | null;
  onSend?: () => void;
  sending?: boolean;
}) {
  const onSend = overrides?.onSend ?? vi.fn();
  render(
    <NewsletterSendDialog
      open
      onOpenChange={vi.fn()}
      preview={overrides?.preview === undefined ? preview : overrides.preview}
      result={null}
      loadingPreview={false}
      sending={overrides?.sending ?? false}
      error={null}
      onSend={onSend}
    />,
  );
  return { onSend };
}

describe('NewsletterSendDialog', () => {
  it('何名に送られるかを出す (issue #614 の制約)', () => {
    renderDialog();
    expect(screen.getByText('137 名')).toBeDefined();
  });

  it('実際に届く HTML を sandbox 付きの iframe で出す', () => {
    renderDialog();
    const iframe = screen.getByTitle('メールのプレビュー');
    expect(iframe.getAttribute('srcdoc')).toContain('本文です。');
    // メールの HTML に script が混ざっても admin 画面で動かさない。
    expect(iframe.getAttribute('sandbox')).toBe('');
  });

  it('テキスト版に切り替えられる（HTML を読まない受信環境の確認用）', () => {
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'テキスト' }));

    expect(screen.queryByTitle('メールのプレビュー')).toBeNull();
    expect(screen.getByText(/本文です。/)).toBeDefined();
  });

  it('1 回目のクリックでは送らない（2 段階の確認を経る）', () => {
    const { onSend } = renderDialog();

    fireEvent.click(screen.getByRole('button', { name: /送信する/ }));

    expect(onSend).not.toHaveBeenCalled();
    // 2 回目のボタンには宛先数が出る（何名に送るのかを最後にもう一度見せる）。
    expect(screen.getByRole('button', { name: /本当に 137 名へ送る/ })).toBeDefined();
  });

  it('2 回目のクリックで送信する', () => {
    const { onSend } = renderDialog();

    fireEvent.click(screen.getByRole('button', { name: /送信する/ }));
    fireEvent.click(screen.getByRole('button', { name: /本当に 137 名へ送る/ }));

    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it('宛先が 0 名なら送信ボタンを押せない', () => {
    renderDialog({ preview: { ...preview, recipientCount: 0, sendable: false } });

    const button = screen.getByRole('button', { name: /送信する/ });
    expect(button.hasAttribute('disabled')).toBe(true);
    expect(screen.getByText(/宛先が 0 名のため送信できません/)).toBeDefined();
  });

  it('送信済みは送信ボタンを押せない', () => {
    renderDialog({ preview: { ...preview, sendable: false } });

    expect(screen.getByRole('button', { name: /送信する/ }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByText(/すでに送信済みです/)).toBeDefined();
  });

  it('送信中は二度押しできない', () => {
    renderDialog({ sending: true });
    expect(screen.getByRole('button', { name: /送信中/ }).hasAttribute('disabled')).toBe(true);
  });
});
