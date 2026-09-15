'use client';

import { verifyAttrs } from '@oryzae/verify';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useId, useRef, useState } from 'react';
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
  const identifierRef = useRef<HTMLInputElement>(null);
  /**
   * SP の紙で、メールアドレスの入力欄を開いたか。
   *
   * 狭い紙（`entrance.compact`）では最初に入り方だけを出す。全部を並べると紙が画面の下に
   * はみ出して「ログイン」が見切れ、扉も押し潰されていた（実機レビュー）。PC の紙では
   * 常に全部を出す。
   */
  const [emailOpen, setEmailOpen] = useState(false);
  const choosing = entrance.compact && !emailOpen;
  const typing = entrance.compact && emailOpen;

  function openEmail() {
    // タップの処理の中で focus しないと、iOS はキーボードを出さない。描画を先に確定させる。
    flushSync(() => setEmailOpen(true));
    identifierRef.current?.focus();
  }
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
      <header className="mb-2 flex items-start gap-3">
        {typing && <PaperBackButton label={t('email_back')} onClick={() => setEmailOpen(false)} />}
        <div className="flex flex-col gap-3">
          <h1 className={BRAND_CLASS} style={SERIF_FONT}>
            Oryzae
          </h1>
          <p className={LEAD_CLASS}>{t('subheading')}</p>
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
          <span className={LABEL_CLASS}>{t('identifier_label')}</span>
          <input
            ref={identifierRef}
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
      </div>

      {/* 入力中（SP の紙）は出さない。紙を短くして送信ボタンを画面に残す。戻れば出る。 */}
      {typing ? null : (
        <p className={`text-center ${FOOT_CLASS}`}>
          {t('no_account_prefix')}{' '}
          <Link href="/signup" className={INLINE_LINK_CLASS}>
            {t('signup_link')}
          </Link>
        </p>
      )}
    </form>
  );
}
