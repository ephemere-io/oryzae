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
  onSendTest?: () => void;
  sending?: boolean;
  testSending?: boolean;
  translating?: boolean;
  testResult?: TestSendResult | null;
  onTranslate?: () => void;
}) {
  const onSend = overrides?.onSend ?? vi.fn();
  const onSendTest = overrides?.onSendTest ?? vi.fn();
  const onTranslate = overrides?.onTranslate ?? vi.fn();
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
      translating={overrides?.translating ?? false}
      error={null}
      onSend={onSend}
      onSendTest={onSendTest}
      onTranslate={onTranslate}
    />,
  );
  return { onSend, onSendTest, onTranslate };
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

  it('テスト済みならその時刻を出す', () => {
    renderDialog();
    expect(screen.getByText(/テスト配信済み/)).toBeDefined();
    expect(screen.queryByText(/まだテスト配信していません/)).toBeNull();
  });

  // ここが緩むと、実際に届く形を一度も見ないまま全員に配信できてしまう。
  it('未テストなら送信ボタンを押せない', () => {
    renderDialog({
      preview: { ...preview, sendable: false, blockedReason: 'not-tested', testSentAt: null },
    });

    expect(screen.getByRole('button', { name: /送信する/ }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByText(/先に「テスト配信」を押して受信を確認/)).toBeDefined();
  });

  // 未テストで塞がれている状態でこそ押したいボタンなので、ここは生きている必要がある。
  it('未テストで送信が塞がれていても、テスト配信ボタンは押せる', () => {
    const { onSendTest } = renderDialog({
      preview: { ...preview, sendable: false, blockedReason: 'not-tested', testSentAt: null },
    });

    const testButton = screen.getByRole('button', { name: /テスト配信/ });
    expect(testButton.hasAttribute('disabled')).toBe(false);

    fireEvent.click(testButton);
    expect(onSendTest).toHaveBeenCalledTimes(1);
  });

  it('送信済みならテスト配信も押せない（もう文面を変えられない）', () => {
    renderDialog({ preview: { ...preview, sendable: false, blockedReason: 'already-sent' } });

    expect(screen.getByRole('button', { name: /テスト配信/ }).hasAttribute('disabled')).toBe(true);
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
        locales: ['ja', 'en'],
      },
    });

    expect(screen.getByText(/admin1@example.com, admin2@example.com/)).toBeDefined();
  });

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
    expect(screen.getByText(/翻訳が必要: English/)).toBeDefined();
  });

  it('翻訳が揃っていればその旨を出す', () => {
    renderDialog();
    expect(screen.getByText(/宛先がいる言語の翻訳は揃っています/)).toBeDefined();
  });

  it('「翻訳を作成」を押すと翻訳だけが走る（本番送信は巻き込まない）', () => {
    const { onTranslate, onSend } = renderDialog();

    fireEvent.click(screen.getByRole('button', { name: /翻訳を作成/ }));

    expect(onTranslate).toHaveBeenCalledTimes(1);
    expect(onSend).not.toHaveBeenCalled();
  });

  it('翻訳中はテスト配信を押せない（同じ下書きを同時に触らせない）', () => {
    renderDialog({ translating: true });
    expect(screen.getByRole('button', { name: /テスト配信/ }).hasAttribute('disabled')).toBe(true);
  });

  it('テスト配信の結果にどの言語版を送ったかを出す', () => {
    renderDialog({
      testResult: {
        newsletter: { ...newsletterFixture, testSentAt: '2026-09-14T07:30:00.000Z' },
        sent: true,
        delivered: 4,
        failed: 0,
        recipients: ['admin1@example.com'],
        locales: ['ja', 'en'],
      },
    });

    expect(screen.getByText(/\(ja\/en\)/)).toBeDefined();
  });

  it('テスト配信中は本番送信を押せない（取り違え防止）', () => {
    renderDialog({ testSending: true });
    expect(screen.getByRole('button', { name: /送信する/ }).hasAttribute('disabled')).toBe(false);
    expect(screen.getByRole('button', { name: /送信中/ }).hasAttribute('disabled')).toBe(true);
  });
});
