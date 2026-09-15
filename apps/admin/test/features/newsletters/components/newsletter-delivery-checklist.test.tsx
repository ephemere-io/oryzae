import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NewsletterDeliveryChecklist } from '@/features/newsletters/components/newsletter-delivery-checklist';
import type { NewsletterPreview } from '@/features/newsletters/types';

// vitest の globals を切ってあるので自動 cleanup が走らない。
afterEach(cleanup);

const preview: NewsletterPreview = {
  id: 'nl-1',
  subject: '今月の更新',
  html: '<p>本文</p>',
  text: '本文',
  recipientCount: 102,
  locales: [
    { locale: 'ja', recipientCount: 94, subject: '今月の更新', html: '<p>本文</p>', text: '本文' },
    { locale: 'en', recipientCount: 7, subject: 'This month', html: '<p>Body.</p>', text: 'Body.' },
    { locale: 'zh', recipientCount: 1, subject: '本月更新', html: '<p>正文。</p>', text: '正文。' },
    { locale: 'ko', recipientCount: 0, subject: null, html: null, text: null },
  ],
  missingTranslations: [],
  sendable: true,
  blockedReason: null,
  testSentAt: '2026-09-15T05:30:00.000Z',
};

function renderChecklist(overrides?: {
  preview?: NewsletterPreview | null;
  readOnly?: boolean;
  unsaved?: boolean;
  translating?: boolean;
  testSending?: boolean;
}) {
  const onTranslate = vi.fn();
  const onSendTest = vi.fn();
  const onOpenSend = vi.fn();
  render(
    <NewsletterDeliveryChecklist
      preview={overrides?.preview === undefined ? preview : overrides.preview}
      loadingPreview={false}
      translating={overrides?.translating ?? false}
      testSending={overrides?.testSending ?? false}
      testResult={null}
      readOnly={overrides?.readOnly ?? false}
      unsaved={overrides?.unsaved ?? false}
      onTranslate={onTranslate}
      onSendTest={onSendTest}
      onOpenSend={onOpenSend}
    />,
  );
  return { onTranslate, onSendTest, onOpenSend };
}

describe('NewsletterDeliveryChecklist', () => {
  // 以前は翻訳もテスト配信も「送信する…」の中にあり、押すのをためらわせた。
  it('3 つの操作をエディタ画面に並べて出す', () => {
    renderChecklist();

    expect(screen.getByRole('button', { name: /翻訳を作成/ })).toBeDefined();
    expect(screen.getByRole('button', { name: /テスト配信/ })).toBeDefined();
    expect(screen.getByRole('button', { name: /送信する…/ })).toBeDefined();
  });

  it('未保存の下書きでは何も押させず、先に保存を促す', () => {
    renderChecklist({ unsaved: true, preview: null });

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText(/下書きを保存すると/)).toBeDefined();
  });

  it('送信済みは操作を出さない', () => {
    renderChecklist({ readOnly: true });

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText(/この配信は送信済みです/)).toBeDefined();
  });

  it('翻訳が必要な言語を名前で出す', () => {
    renderChecklist({
      preview: {
        ...preview,
        missingTranslations: ['en', 'zh'],
        sendable: false,
        blockedReason: 'translations-missing',
      },
    });

    expect(screen.getByText(/必要: English \/ 简体中文/)).toBeDefined();
  });

  // 「必要な言語: なし」と出すより、要らないと言い切るほうが迷わない。
  it('日本語の宛先しかいなければ翻訳を要らないと言い、ボタンを無効にする', () => {
    renderChecklist({
      preview: {
        ...preview,
        locales: preview.locales.map((l) => (l.locale === 'ja' ? l : { ...l, recipientCount: 0 })),
      },
    });

    expect(screen.getByText(/日本語の宛先のみ。翻訳は要りません/)).toBeDefined();
    expect(screen.getByRole('button', { name: /翻訳を作成/ }).hasAttribute('disabled')).toBe(true);
  });

  it('テスト配信済みならその時刻を出す', () => {
    renderChecklist();
    expect(screen.getByText(/に運営者へ送信済み/)).toBeDefined();
  });

  // ここが緩むと、実際に届く形を一度も見ないまま全員に配信できてしまう。
  it('送れない状態では送信ボタンを押せず、理由を出す', () => {
    renderChecklist({
      preview: { ...preview, sendable: false, blockedReason: 'not-tested', testSentAt: null },
    });

    expect(screen.getByRole('button', { name: /送信する…/ }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByText(/先に「テスト配信」を押して受信を確認/)).toBeDefined();
  });

  it('送れる状態なら何名に送るかを出す', () => {
    renderChecklist();

    expect(screen.getByRole('button', { name: /送信する…/ }).hasAttribute('disabled')).toBe(false);
    expect(screen.getByText(/102 名へ送ります/)).toBeDefined();
  });

  it('それぞれのボタンが自分の操作だけを呼ぶ', () => {
    const { onTranslate, onSendTest, onOpenSend } = renderChecklist();

    fireEvent.click(screen.getByRole('button', { name: /翻訳を作成/ }));
    expect(onTranslate).toHaveBeenCalledTimes(1);
    expect(onSendTest).not.toHaveBeenCalled();
    expect(onOpenSend).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /テスト配信/ }));
    expect(onSendTest).toHaveBeenCalledTimes(1);
    expect(onOpenSend).not.toHaveBeenCalled();
  });

  it('翻訳中・テスト送信中は他の操作を押せない（同じ下書きを同時に触らせない）', () => {
    renderChecklist({ translating: true });

    expect(screen.getByRole('button', { name: /翻訳中/ }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: /テスト配信/ }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: /送信する…/ }).hasAttribute('disabled')).toBe(true);
  });
});
