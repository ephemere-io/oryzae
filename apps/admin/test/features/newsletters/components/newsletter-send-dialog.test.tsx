import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NewsletterSendDialog } from '@/features/newsletters/components/newsletter-send-dialog';
import type { Newsletter, NewsletterPreview, TestSendResult } from '@/features/newsletters/types';

// vitest の globals を切ってあるので自動 cleanup が走らない。
// 明示しないと Dialog の portal が document.body に残り、次のテストで二重に見つかる。
afterEach(cleanup);

const newsletterFixture: Newsletter = {
  id: 'nl-1',
  subject: '今月の更新',
  bodyMarkdown: '本文',
  status: 'draft',
  createdBy: 'admin-1',
  recipientCount: 0,
  sentCount: 0,
  failedCount: 0,
  lastError: null,
  testSentAt: null,
  sentAt: null,
  createdAt: '2026-09-14T00:00:00.000Z',
  updatedAt: '2026-09-14T00:00:00.000Z',
};

const preview: NewsletterPreview = {
  id: 'nl-1',
  subject: '今月の更新',
  html: '<html><body><p>本文です。</p></body></html>',
  text: '今月の更新\n\n本文です。',
  recipientCount: 137,
  sendable: true,
  testSentAt: null,
};

function renderDialog(overrides?: {
  preview?: NewsletterPreview | null;
  onSend?: () => void;
  onSendTest?: () => void;
  sending?: boolean;
  testSending?: boolean;
  testResult?: TestSendResult | null;
}) {
  const onSend = overrides?.onSend ?? vi.fn();
  const onSendTest = overrides?.onSendTest ?? vi.fn();
  render(
    <NewsletterSendDialog
      open
      onOpenChange={vi.fn()}
      preview={overrides?.preview === undefined ? preview : overrides.preview}
      result={null}
      testResult={overrides?.testResult ?? null}
      loadingPreview={false}
      sending={overrides?.sending ?? false}
      testSending={overrides?.testSending ?? false}
      error={null}
      onSend={onSend}
      onSendTest={onSendTest}
    />,
  );
  return { onSend, onSendTest };
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

  it('未テストなら警告を出す（本番の前に自分たちへ送らせる）', () => {
    renderDialog();
    expect(screen.getByText(/まだテスト配信していません/)).toBeDefined();
  });

  it('テスト済みならその時刻を出す', () => {
    renderDialog({ preview: { ...preview, testSentAt: '2026-09-14T07:30:00.000Z' } });
    expect(screen.getByText(/テスト配信済み/)).toBeDefined();
    expect(screen.queryByText(/まだテスト配信していません/)).toBeNull();
  });

  it('テスト配信ボタンは 1 クリックで撃てる（宛先が運営者に固定されているため）', () => {
    const { onSendTest, onSend } = renderDialog();

    fireEvent.click(screen.getByRole('button', { name: /テスト配信/ }));

    expect(onSendTest).toHaveBeenCalledTimes(1);
    // 本番送信は巻き込まない。
    expect(onSend).not.toHaveBeenCalled();
  });

  it('テスト配信の結果に実際の宛先を出す（届かないときの切り分け材料）', () => {
    renderDialog({
      testResult: {
        newsletter: { ...newsletterFixture, testSentAt: '2026-09-14T07:30:00.000Z' },
        sent: true,
        delivered: 2,
        failed: 0,
        recipients: ['admin1@example.com', 'admin2@example.com'],
      },
    });

    expect(screen.getByText(/admin1@example.com, admin2@example.com/)).toBeDefined();
  });

  it('テスト配信中は本番送信を押せない（取り違え防止）', () => {
    renderDialog({ testSending: true });
    expect(screen.getByRole('button', { name: /送信する/ }).hasAttribute('disabled')).toBe(false);
    expect(screen.getByRole('button', { name: /送信中/ }).hasAttribute('disabled')).toBe(true);
  });
});
