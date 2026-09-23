import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SignupForm } from '@/features/shared/auth/components/signup-form';
import messages from '@/i18n/messages/ja.json';

/**
 * 登録後の着地。
 *
 * ログインは `useHomeHref` で書斎へ送るのに、登録だけ `/entries` を直書きしていた。
 * 登録した人はいちばん初めての人なので、ここがずれるとヘルプの三歩を見ないまま
 * 一覧に落ちる。login-form.test.tsx と同じ動線を、登録側でも縛る。
 */
const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

// PostHog は provider が無ければ undefined（＝「まだ分からない」）。
vi.mock('posthog-js/react', () => ({ useFeatureFlagEnabled: () => undefined }));

const signup = vi.fn();
// セッションが返った（メール確認が無効）ときの auth。null なら「メールを送った」画面になる。
let authState: { accessToken: string } | null = null;

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    signup: (nickname: string, email: string, password: string, locale: string) =>
      signup(nickname, email, password, locale),
    auth: authState,
  }),
}));

// Google ボタンは Supabase の設定を読むので、行き先の検証には不要。
vi.mock('@/features/shared/auth/components/google-login-button', () => ({
  GoogleLoginButton: () => null,
}));

// 登録枠はマウント時に fetch するので、行き先の検証では黙らせる。
vi.mock('@/features/shared/auth/hooks/use-signup-availability', () => ({
  useSignupAvailability: () => ({ availability: null, loading: false, error: null }),
}));

function setSearch(search: string): void {
  window.history.replaceState({}, '', `/signup${search}`);
}

function renderForm() {
  return render(
    <NextIntlClientProvider locale="ja" messages={messages}>
      <SignupForm />
    </NextIntlClientProvider>,
  );
}

function input(selector: string): Element {
  return document.querySelector(selector) ?? document.body;
}

async function submit(): Promise<void> {
  fireEvent.change(input('input[type="text"]'), { target: { value: 'taro_1' } });
  fireEvent.change(input('input[type="email"]'), { target: { value: 'someone@example.com' } });
  for (const el of document.querySelectorAll('input[type="password"]')) {
    fireEvent.change(el, { target: { value: 'password123' } });
  }
  fireEvent.click(screen.getByRole('button', { name: messages.auth.signup.submit }));
}

beforeEach(() => {
  push.mockClear();
  signup.mockClear();
  signup.mockResolvedValue(null);
  authState = { accessToken: 'at' };
  localStorage.clear();
  setSearch('');
});

afterEach(cleanup);

describe('SignupForm', () => {
  it('何も付けていなければ、登録した先は書斎（ログインと同じ規則）', async () => {
    renderForm();
    await submit();

    await waitFor(() => expect(push).toHaveBeenCalledWith('/'));
  });

  it('書斎を止めている端末（?study=off）なら従来の入口へ送る', async () => {
    setSearch('?study=off');
    renderForm();
    await submit();

    await waitFor(() => expect(push).toHaveBeenCalledWith('/entries/new'));
  });

  it('セッションが返らなければ（メール確認あり）遷移せず案内を出す', async () => {
    authState = null;
    renderForm();
    await submit();

    await waitFor(() => expect(signup).toHaveBeenCalled());
    expect(await screen.findByText(messages.auth.signup.back_to_login)).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });

  it('登録に失敗したら遷移しない', async () => {
    signup.mockResolvedValue('email_taken');
    renderForm();
    await submit();

    await waitFor(() => expect(signup).toHaveBeenCalled());
    expect(push).not.toHaveBeenCalled();
  });
});
