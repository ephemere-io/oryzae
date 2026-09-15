import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NewsletterSendDialog } from '@/features/newsletters/components/newsletter-send-dialog';
import type { NewsletterPreview, TestSendResult } from '@/features/newsletters/types';

// vitest の globals を切ってあるので自動 cleanup が走らない。
// 明示しないと Dialog の portal が document.body に残り、次のテストで二重に見つかる。
afterEach(cleanup);

const preview: NewsletterPreview = {
  id: 'nl-1',
  subject: '今月の更新',
  html: '<html><body><p>本文です。</p></body></html>',
  text: '今月の更新\n\n本文です。',
  recipientCount: 137,
  locales: [
    {
      locale: 'ja',
      recipientCount: 129,
      subject: '今月の更新',
      html: '<p>本文です。</p>',
      text: '本文です。',
    },
    { locale: 'en', recipientCount: 7, subject: 'This month', html: '<p>Body.</p>', text: 'Body.' },
    { locale: 'zh', recipientCount: 1, subject: '本月更新', html: '<p>正文。</p>', text: '正文。' },
    { locale: 'ko', recipientCount: 0, subject: null, html: null, text: null },
  ],
  missingTranslations: [],
  sendable: true,
  blockedReason: null,
  testSentAt: '2026-09-14T07:30:00.000Z',
};

function renderDialog(overrides?: {
  preview?: NewsletterPreview | null;
  onSend?: () => void;
  sending?: boolean;
  testResult?: TestSendResult | null;
}) {
  const onSend = overrides?.onSend ?? vi.fn();
  render(
    <NewsletterSendDialog
      open
      onOpenChange={vi.fn()}
      preview={overrides?.preview === undefined ? preview : overrides.preview}
      result={null}
      testResult={overrides?.testResult ?? null}
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
    renderDialog({
      preview: { ...preview, recipientCount: 0, sendable: false, blockedReason: 'no-recipients' },
    });

    const button = screen.getByRole('button', { name: /送信する/ });
    expect(button.hasAttribute('disabled')).toBe(true);
    expect(screen.getByText(/宛先が 0 名のため送信できません/)).toBeDefined();
  });

  it('送信済みは送信ボタンを押せない', () => {
    renderDialog({ preview: { ...preview, sendable: false, blockedReason: 'already-sent' } });

    expect(screen.getByRole('button', { name: /送信する/ }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByText(/すでに送信済みです/)).toBeDefined();
  });

  it('送信中は二度押しできない', () => {
    renderDialog({ sending: true });
    expect(screen.getByRole('button', { name: /送信中/ }).hasAttribute('disabled')).toBe(true);
  });

  // 未テストで塞がれている状態でこそ押したいボタンなので、ここは生きている必要がある。

  // 日本語だけ見て送ると、英語版が崩れていても気づけない。
  it('言語ごとに宛先数を出し、切り替えるとその言語の本文が出る', () => {
    renderDialog();

    // 既定は原文（日本語）。
    expect(screen.getByTitle('メールのプレビュー').getAttribute('srcdoc')).toContain('本文です。');

    fireEvent.click(screen.getByRole('button', { name: /English/ }));
    expect(screen.getByTitle('メールのプレビュー').getAttribute('srcdoc')).toContain('Body.');
    expect(screen.getByText('This month')).toBeDefined();
  });

  it('宛先が 0 名の言語も並べる（存在を隠さない）', () => {
    renderDialog();
    expect(screen.getByRole('button', { name: /한국어/ })).toBeDefined();
  });

  it('翻訳が無い言語に切り替えたら、作り方を案内する', () => {
    renderDialog();

    fireEvent.click(screen.getByRole('button', { name: /한국어/ }));

    expect(screen.queryByTitle('メールのプレビュー')).toBeNull();
    expect(screen.getByText(/この言語の翻訳がまだありません/)).toBeDefined();
  });

  // 原文にフォールバックすると「英語のつもりが日本語で届いた」が黙って起きる。
  it('宛先がいる言語の翻訳が無ければ送信ボタンを押せない', () => {
    renderDialog({
      preview: {
        ...preview,
        sendable: false,
        blockedReason: 'translations-missing',
        missingTranslations: ['en'],
        locales: preview.locales.map((l) =>
          l.locale === 'en' ? { ...l, subject: null, html: null, text: null } : l,
        ),
      },
    });

    expect(screen.getByRole('button', { name: /送信する/ }).hasAttribute('disabled')).toBe(true);
    // 理由はサーバーの blockedReason をそのまま文言にする（画面で推測しない）。
    expect(screen.getByText(/宛先がいる言語の翻訳が揃っていません/)).toBeDefined();
  });
});
