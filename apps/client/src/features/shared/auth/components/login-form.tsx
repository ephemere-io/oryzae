'use client';

import { verifyAttrs } from '@oryzae/verify';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { GoogleLoginButton } from '@/features/shared/auth/components/google-login-button';
import { useEntrance } from '@/features/shared/auth/entrance/context';
import {
  BRAND_CLASS,
  DIVIDER_LINE_CLASS,
  DIVIDER_TEXT_CLASS,
  ERROR_CLASS,
  FOOT_CLASS,
  INLINE_LINK_CLASS,
  INPUT_CLASS,
  LABEL_CLASS,
  LEAD_CLASS,
  PAPER_STACK_CLASS,
  PRIMARY_BUTTON_CLASS,
  QUIET_LINK_CLASS,
  SERIF_FONT,
} from '@/features/shared/auth/entrance/paper';
import { translateAuthError } from '@/features/shared/auth/error-messages';
import { useHomeHref } from '@/features/shared/study/hooks/use-home-href';
import { useAuth } from '@/lib/auth-context';

export function LoginForm() {
  const t = useTranslations('auth.login');
  const tErr = useTranslations('auth.error');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { login } = useAuth();
  const entrance = useEntrance();
  const passwordId = useId();
  // 行き先は HomeGate と同じものを使う。ここで /entries/new を直書きすると、
  // ?study=on を付けても「ログインした先が書斎にならない」。
  const { href: home, resolved } = useHomeHref();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    // 確かめている間、扉に手を掛けておく。通らなければ閉じ直す。
    entrance.setWaiting(true);

    const err = await login(identifier, password);
    if (err) {
      setError(translateAuthError(err, tErr));
      setLoading(false);
      entrance.setWaiting(false);
      return;
    }

    // 扉を開けて奥へ歩き、地の色に溶け切ってから移る。先に移ると扉が開く前に画面が変わる。
    await entrance.enter();
    // 手動切替はマウント時の effect で読むので、送信までにはまず解決している。
    // 万一まだなら `/` へ送る（HomeGate が同じ規則で振り分ける）。
    router.push(resolved ? home : '/');
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={PAPER_STACK_CLASS}
      {...verifyAttrs({
        unit: 'LoginForm',
        filled: identifier.trim().length > 0 && password.length > 0,
        loading,
        hasError: error.length > 0,
      })}
    >
      <header className="mb-2 flex flex-col gap-3">
        <h1 className={BRAND_CLASS} style={SERIF_FONT}>
          Oryzae
        </h1>
        <p className={LEAD_CLASS}>{t('subheading')}</p>
      </header>

      <GoogleLoginButton />

      <div className="flex items-center gap-3">
        <div className={DIVIDER_LINE_CLASS} />
        <span className={DIVIDER_TEXT_CLASS}>{t('divider_or')}</span>
        <div className={DIVIDER_LINE_CLASS} />
      </div>

      {error && (
        <p role="alert" className={ERROR_CLASS}>
          {error}
        </p>
      )}

      <label className="flex flex-col gap-2">
        <span className={LABEL_CLASS}>{t('identifier_label')}</span>
        <input
          type="text"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          required
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="nickname or email@example.com"
          className={INPUT_CLASS}
        />
      </label>

      <div className="flex flex-col gap-2">
        {/* 「忘れた方」はラベルの行の右端に置く。<label> の中にリンクを入れると、
            リンクを押したつもりが入力欄に吸われる。 */}
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor={passwordId} className={LABEL_CLASS}>
            {t('password_label')}
          </label>
          <Link href="/forgot-password" className={QUIET_LINK_CLASS}>
            {t('forgot_link')}
          </Link>
        </div>
        <input
          id={passwordId}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          autoComplete="current-password"
          className={INPUT_CLASS}
        />
      </div>

      <button type="submit" disabled={loading} className={`mt-1 ${PRIMARY_BUTTON_CLASS}`}>
        {loading ? t('submit_loading') : t('submit')}
      </button>

      <p className={`text-center ${FOOT_CLASS}`}>
        {t('no_account_prefix')}{' '}
        <Link href="/signup" className={INLINE_LINK_CLASS}>
          {t('signup_link')}
        </Link>
      </p>
    </form>
  );
}
