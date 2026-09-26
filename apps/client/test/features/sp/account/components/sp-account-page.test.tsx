import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HelpProvider, useHelpMode } from '@/features/shared/help/help-context';
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

/** ヘルプの面が開いているかを外から読むための覗き穴。 */
function HelpOpenProbe() {
  const help = useHelpMode();
  return <output data-testid="help-open">{help.open ? 'open' : 'closed'}</output>;
}

function renderWithHelp() {
  render(
    <NextIntlClientProvider locale="ja" messages={jaMessages}>
      <HelpProvider api={null}>
        <SpAccountPage user={user} onLogout={vi.fn()} />
        <HelpOpenProbe />
      </HelpProvider>
    </NextIntlClientProvider>,
  );
}

describe('SpAccountPage — ヘルプモードの行', () => {
  const { open, toggle } = jaMessages.account.help_mode;

  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(cleanup);

  it('有効なら「開く」があり、押すとシートが開く（SP の「?」は書斎にしか無い）', () => {
    renderWithHelp();
    expect(screen.getByTestId('help-open').textContent).toBe('closed');
    fireEvent.click(screen.getByRole('button', { name: open }));
    expect(screen.getByTestId('help-open').textContent).toBe('open');
  });

  it('無効にすると「開く」は消え、もう一度切り替えれば戻る', () => {
    renderWithHelp();
    // テーマの行にも「切り替え」がある。ヘルプの切り替えだけが aria-pressed を持つ。
    fireEvent.click(screen.getByRole('button', { name: toggle, pressed: true }));
    expect(screen.queryByRole('button', { name: open })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: toggle, pressed: false }));
    expect(screen.getByRole('button', { name: open })).toBeTruthy();
  });

  it('Provider の外（無効）では「開く」を出さない', () => {
    renderPage();
    expect(screen.queryByRole('button', { name: open })).toBeNull();
  });
});
