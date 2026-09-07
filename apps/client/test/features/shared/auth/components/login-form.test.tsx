import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginForm } from '@/features/shared/auth/components/login-form';
import messages from '@/i18n/messages/ja.json';

/**
 * ログイン後の着地。
 *
 * 行き先を直書きすると `?study=on` を付けてプレビューを開いても書斎に入れない
 * （未ログイン → /login → ログイン → 従来の入口）。プレビューは本番と別オリジンで
 * 常に未ログインなので、確認する人は必ずこの動線を通る。
 */
const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

// PostHog は provider が無ければ undefined（＝「まだ分からない」）。
vi.mock('posthog-js/react', () => ({ useFeatureFlagEnabled: () => undefined }));

const login = vi.fn();

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ login: (id: string, pw: string) => login(id, pw) }),
}));

// Google ボタンは Supabase の設定を読むので、行き先の検証には不要。
vi.mock('@/features/shared/auth/components/google-login-button', () => ({
  GoogleLoginButton: () => null,
}));

function setSearch(search: string): void {
  window.history.replaceState({}, '', `/login${search}`);
}

function renderForm() {
  return render(
    <NextIntlClientProvider locale="ja" messages={messages}>
      <LoginForm />
    </NextIntlClientProvider>,
  );
}

async function submit(): Promise<void> {
  fireEvent.change(screen.getByPlaceholderText('nickname or email@example.com'), {
    target: { value: 'someone@example.com' },
  });
  fireEvent.change(document.querySelector('input[type="password"]') ?? document.body, {
    target: { value: 'password123' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'ログイン' }));
}

beforeEach(() => {
  push.mockClear();
  login.mockClear();
  login.mockResolvedValue(null);
  localStorage.clear();
  setSearch('');
});

afterEach(cleanup);

describe('LoginForm', () => {
  it('書斎ホームが off なら従来の入口へ送る', async () => {
    renderForm();
    await submit();

    await waitFor(() => expect(push).toHaveBeenCalledWith('/entries/new'));
  });

  it('?study=on を付けて開いていれば、ログインした先が書斎になる', async () => {
    // ここが本題。プレビューで確認を始められるかどうかが、この 1 本にかかっている。
    setSearch('?study=on');
    renderForm();
    await submit();

    await waitFor(() => expect(push).toHaveBeenCalledWith('/study'));
  });

  it('前に ?study=on を触った端末は、付け直さなくても書斎へ送られる', async () => {
    localStorage.setItem('oryzae_study_home', 'on');
    renderForm();
    await submit();

    await waitFor(() => expect(push).toHaveBeenCalledWith('/study'));
  });

  it('ログインに失敗したら遷移しない', async () => {
    login.mockResolvedValue('invalid_credentials');
    renderForm();
    await submit();

    await waitFor(() => expect(login).toHaveBeenCalled());
    expect(push).not.toHaveBeenCalled();
  });
});
