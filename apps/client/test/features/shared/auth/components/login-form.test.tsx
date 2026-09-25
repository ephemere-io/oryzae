import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginForm } from '@/features/shared/auth/components/login-form';
import { EntranceContext } from '@/features/shared/auth/entrance/context';
import type { EntranceControls } from '@/features/shared/auth/types';
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
  it('書斎を止めている端末（?study=off）なら従来の入口へ送る', async () => {
    // 既定は書斎なので、従来の入口は撤退口（?study=off）の下でだけ通る。
    setSearch('?study=off');
    renderForm();
    await submit();

    await waitFor(() => expect(push).toHaveBeenCalledWith('/entries/new'));
  });

  it('何も付けていなければ、ログインした先は書斎（既定で全員に書斎ホーム）', async () => {
    // ここが本題。プレビューで確認を始められるかどうかが、この 1 本にかかっている。
    renderForm();
    await submit();

    await waitFor(() => expect(push).toHaveBeenCalledWith('/'));
  });

  it('?study=on を付けて開いていれば、ログインした先が書斎になる', async () => {
    // ここが本題。プレビューで確認を始められるかどうかが、この 1 本にかかっている。
    setSearch('?study=on');
    renderForm();
    await submit();

    await waitFor(() => expect(push).toHaveBeenCalledWith('/'));
  });

  it('前に ?study=on を触った端末は、付け直さなくても書斎へ送られる', async () => {
    localStorage.setItem('oryzae_study_home', 'on');
    renderForm();
    await submit();

    await waitFor(() => expect(push).toHaveBeenCalledWith('/'));
  });

  it('ログインに失敗したら遷移しない', async () => {
    login.mockResolvedValue('invalid_credentials');
    renderForm();
    await submit();

    await waitFor(() => expect(login).toHaveBeenCalled());
    expect(push).not.toHaveBeenCalled();
  });
});

describe('LoginForm（扉の前の紙）', () => {
  const IDENTIFIER = 'ニックネームまたはメールアドレス';

  function renderOnPaper(controls: EntranceControls) {
    return render(
      <NextIntlClientProvider locale="ja" messages={messages}>
        <EntranceContext.Provider value={controls}>
          <LoginForm />
        </EntranceContext.Provider>
      </NextIntlClientProvider>,
    );
  }

  function controls(overrides: Partial<EntranceControls> = {}): EntranceControls {
    return {
      compact: false,
      setWaiting: vi.fn(),
      enter: vi.fn(() => Promise.resolve()),
      ...overrides,
    };
  }

  it('扉を開けて入り終えてから移る（先に移ると扉が開く前に画面が変わる）', async () => {
    let finishWalking: () => void = () => {};
    const enter = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishWalking = resolve;
        }),
    );
    const setWaiting = vi.fn();
    renderOnPaper(controls({ enter, setWaiting }));
    await submit();

    await waitFor(() => expect(enter).toHaveBeenCalled());
    expect(setWaiting).toHaveBeenCalledWith(true);
    expect(push).not.toHaveBeenCalled();
    finishWalking();
    await waitFor(() => expect(push).toHaveBeenCalledWith('/'));
  });

  it('失敗したら扉を閉じ直し、入らない', async () => {
    login.mockResolvedValue('invalid_credentials');
    const setWaiting = vi.fn();
    const enter = vi.fn(() => Promise.resolve());
    renderOnPaper(controls({ setWaiting, enter }));
    await submit();

    await waitFor(() => expect(setWaiting).toHaveBeenLastCalledWith(false));
    expect(enter).not.toHaveBeenCalled();
  });

  it('狭い紙（SP）では入り方だけを出し、入力欄と送信ボタンは選ぶまで隠す', () => {
    // 全部を並べると紙が画面の下にはみ出して「ログイン」が見切れた（実機レビュー）。
    renderOnPaper(controls({ compact: true }));

    expect(screen.getByRole('button', { name: 'メールアドレスでログイン' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'ログイン' })).toBeNull();
    // DOM には置いてある（focus を同じタップで渡すため）が、見えも読み上げもしない。
    expect(screen.queryByRole('textbox', { name: IDENTIFIER })).toBeNull();
    expect(screen.getByRole('link', { name: 'サインアップ' })).toBeTruthy();
  });

  it('メールアドレスを選ぶと入力欄が開いて focus が入り、戻ると選ぶところへ戻る', () => {
    renderOnPaper(controls({ compact: true }));

    fireEvent.click(screen.getByRole('button', { name: 'メールアドレスでログイン' }));
    const identifier = screen.getByRole('textbox', { name: IDENTIFIER });
    // 同じタップの中で focus を渡す（iOS はそうしないとキーボードを出さない）。
    expect(document.activeElement).toBe(identifier);
    expect(screen.getByRole('button', { name: 'ログイン' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '戻る' }));
    expect(screen.getByRole('button', { name: 'メールアドレスでログイン' })).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: IDENTIFIER })).toBeNull();
  });

  it('広い紙（PC）では最初から全部を出す', () => {
    renderOnPaper(controls({ compact: false }));

    expect(screen.queryByRole('button', { name: 'メールアドレスでログイン' })).toBeNull();
    expect(screen.getByPlaceholderText('nickname or email@example.com')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'ログイン' })).toBeTruthy();
  });
});
