'use client';

import { verifyAttrs } from '@oryzae/verify';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { GoogleLoginButton } from '@/features/shared/auth/components/google-login-button';
import { PaperBackButton } from '@/features/shared/auth/components/paper-back-button';
import { useEntrance } from '@/features/shared/auth/entrance/context';
import {
  BRAND_CLASS,
  DIVIDER_LINE_CLASS,
  DIVIDER_TEXT_CLASS,
  ERROR_CLASS,
  FOOT_CLASS,
  HELP_CLASS,
  INLINE_LINK_CLASS,
  INPUT_CLASS,
  LABEL_CLASS,
  LEAD_CLASS,
  PAPER_STACK_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  SERIF_FONT,
} from '@/features/shared/auth/entrance/paper';
import { translateAuthError } from '@/features/shared/auth/error-messages';
import { useSignupAvailability } from '@/features/shared/auth/hooks/use-signup-availability';
import { useAuth } from '@/lib/auth-context';

function isSupportedLocale(value: string): value is 'ja' | 'en' | 'zh' | 'ko' {
  return value === 'ja' || value === 'en' || value === 'zh' || value === 'ko';
}

export function SignupForm() {
  const t = useTranslations('auth.signup');
  const tErr = useTranslations('auth.error');
  const localeRaw = useLocale();
  const locale = isSupportedLocale(localeRaw) ? localeRaw : 'ja';
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const router = useRouter();
  const { signup, auth } = useAuth();
  const entrance = useEntrance();
  // Issue #300: Research Preview の登録枠状況をマウント時に取得
  const { availability } = useSignupAvailability();
  const nicknameRef = useRef<HTMLInputElement>(null);
  // SP の紙では入り方（Google / メールアドレス）を先に選ぶ（LoginForm と同じ理由）。
  const [emailOpen, setEmailOpen] = useState(false);
  const choosing = entrance.compact && !emailOpen;
  const typing = entrance.compact && emailOpen;

  function openEmail() {
    // タップの処理の中で focus しないと、iOS はキーボードを出さない。
    flushSync(() => setEmailOpen(true));
    nicknameRef.current?.focus();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== passwordConfirm) {
      setError(t('error_password_mismatch'));
      return;
    }

    setLoading(true);
    entrance.setWaiting(true);

    const err = await signup(nickname, email, password, locale);
    if (err) {
      setError(translateAuthError(err, tErr));
      setLoading(false);
      entrance.setWaiting(false);
      return;
    }

    // If session was returned (email confirmation disabled), go to entries
    if (auth) {
      await entrance.enter();
      router.push('/entries');
      return;
    }

    // 確認メール待ち。扉はまだ開かない（メールのリンクから戻ってきたときに開く）。
    entrance.setWaiting(false);
    setEmailSent(true);
    setLoading(false);
  }

  if (emailSent) {
    return (
      <div className={PAPER_STACK_CLASS}>
        <header className="flex flex-col gap-3">
          <h1 className={BRAND_CLASS} style={SERIF_FONT}>
            Oryzae
          </h1>
          <p className={LEAD_CLASS}>{t('email_sent_subheading')}</p>
        </header>
        <p className="text-[14px] leading-relaxed text-[#5c4f3f]">
          <span className="font-medium text-[#2d2d2d]">{email}</span> {t('email_sent_body')}
        </p>
        <Link href="/login" className={SECONDARY_BUTTON_CLASS}>
          {t('back_to_login')}
        </Link>
      </div>
    );
  }

  // Issue #300: Research Preview 登録枠が満了したら、フォーム自体を出さずに案内のみ
  if (availability?.capacityReached) {
    return (
      <div className={PAPER_STACK_CLASS}>
        <header className="flex flex-col gap-3">
          <h1 className={BRAND_CLASS} style={SERIF_FONT}>
            Oryzae
          </h1>
          <p className="text-[15px] font-medium text-[#2d2d2d]">{t('capacity_full_title')}</p>
        </header>
        <p className="text-[14px] leading-relaxed text-[#5c4f3f]">
          {t('capacity_full_body', { max: availability.limit })}
        </p>
        <Link href="/login" className={SECONDARY_BUTTON_CLASS}>
          {t('back_to_login')}
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={PAPER_STACK_CLASS}
      {...verifyAttrs({
        unit: 'SignupForm',
        hasNickname: Boolean(nickname),
        hasEmail: Boolean(email),
        hasPassword: Boolean(password),
        hasConfirm: Boolean(passwordConfirm),
        hasError: Boolean(error),
      })}
    >
      <header className="mb-2 flex items-start gap-3">
        {typing && <PaperBackButton label={t('email_back')} onClick={() => setEmailOpen(false)} />}
        <div className="flex flex-col gap-3">
          <h1 className={BRAND_CLASS} style={SERIF_FONT}>
            Oryzae
          </h1>
          <p className={LEAD_CLASS}>{t('subheading')}</p>
          {availability && !availability.capacityReached && !typing && (
            <p className={`-mt-1 ${HELP_CLASS}`}>
              {t('capacity_remaining', {
                remaining: availability.remaining,
                max: availability.limit,
              })}
            </p>
          )}
        </div>
      </header>

      {typing ? null : <GoogleLoginButton />}

      {entrance.compact ? null : (
        <div className="flex items-center gap-3">
          <div className={DIVIDER_LINE_CLASS} />
          <span className={DIVIDER_TEXT_CLASS}>{t('divider_or')}</span>
          <div className={DIVIDER_LINE_CLASS} />
        </div>
      )}

      {choosing && (
        <button type="button" onClick={openEmail} className={PRIMARY_BUTTON_CLASS}>
          {t('email_open')}
        </button>
      )}

      {/* 入力欄は選ぶ前も DOM に置いて隠す。開いた同じタップの中で focus を渡すため。 */}
      <div hidden={choosing} className={`flex flex-col ${typing ? 'gap-4' : 'gap-5'}`}>
        {error && (
          <p role="alert" className={ERROR_CLASS}>
            {error}
          </p>
        )}

        <label className="flex flex-col gap-2">
          <span className={LABEL_CLASS}>{t('nickname_label')}</span>
          <input
            ref={nicknameRef}
            type="text"
            aria-label={t('nickname_label')}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            required
            minLength={2}
            maxLength={30}
            pattern="^[a-zA-Z0-9_-]+$"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="my_nickname"
            className={INPUT_CLASS}
          />
          <span className={HELP_CLASS}>{t('nickname_help')}</span>
        </label>

        <label className="flex flex-col gap-2">
          <span className={LABEL_CLASS}>{t('email_label')}</span>
          <input
            type="email"
            aria-label={t('email_label')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className={INPUT_CLASS}
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className={LABEL_CLASS}>{t('password_label')}</span>
          <input
            type="password"
            aria-label={t('password_label')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
            className={INPUT_CLASS}
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className={LABEL_CLASS}>{t('confirm_label')}</span>
          <input
            type="password"
            aria-label={t('confirm_label')}
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
            className={INPUT_CLASS}
          />
        </label>

        <button type="submit" disabled={loading} className={`mt-1 ${PRIMARY_BUTTON_CLASS}`}>
          {loading ? t('submit_loading') : t('submit')}
        </button>
      </div>

      {/* 入力中（SP の紙）は出さない。紙を短くして送信ボタンを画面に残す。戻れば出る。 */}
      {typing ? null : (
        <p className={`text-center ${FOOT_CLASS}`}>
          {t('have_account_prefix')}{' '}
          <Link href="/login" className={INLINE_LINK_CLASS}>
            {t('login_link')}
          </Link>
        </p>
      )}
    </form>
  );
}
