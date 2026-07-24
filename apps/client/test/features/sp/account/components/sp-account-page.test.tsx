import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SpAccountPage } from '@/features/sp/account/components/sp-account-page';
import jaMessages from '@/i18n/messages/ja.json';

const user = {
  id: 'u1',
  email: 'me@example.com',
  nickname: 'ゆき',
  avatarUrl: null,
  name: null,
  providers: ['email'],
};

function renderPage(onLogout = vi.fn()) {
  render(
    <NextIntlClientProvider locale="ja" messages={jaMessages}>
      <SpAccountPage user={user} onLogout={onLogout} />
    </NextIntlClientProvider>,
  );
  return onLogout;
}

describe('SpAccountPage', () => {
  afterEach(cleanup);

  it('プロフィール（表示名・メール）を表示する', () => {
    renderPage();
    // 表示名はヘッダとニックネーム欄の両方に出る
    expect(screen.getAllByText('ゆき').length).toBeGreaterThan(0);
    expect(screen.getByText('me@example.com')).toBeTruthy();
  });

  it('ログアウトボタンをタップすると onLogout が呼ばれる', () => {
    const onLogout = renderPage();
    fireEvent.click(screen.getByRole('button', { name: jaMessages.account.logout.button }));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it('ニックネームの編集に入れる', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: jaMessages.account.field.edit }));
    // 編集モードでニックネームの現在値が input に出る
    expect(screen.getByDisplayValue('ゆき')).toBeTruthy();
  });
});
