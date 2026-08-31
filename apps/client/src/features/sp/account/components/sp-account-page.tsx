'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useLocale, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { useAccountApi } from '@/features/shared/account/hooks/use-account-api';
import type { AccountUser } from '@/features/shared/account/types';
import { isLocale, LOCALE_OPTIONS } from '@/i18n/config';
import { docsHref } from '@/lib/docs-site';
import { setLocaleAction } from '@/lib/i18n-actions';
import { useTheme } from '@/lib/theme-context';

const LOCALE_LABELS: Record<string, string> = Object.fromEntries(
  LOCALE_OPTIONS.map((o) => [o.locale, o.label]),
);

interface SpAccountPageProps {
  user: AccountUser;
  onLogout: () => void;
}

/**
 * SP 版アカウント画面（Issue #363）。PC の AccountPage を参考に、モバイルで
 * 設定とログアウトに到達できるようにする。データ系は lib（api/auth/theme/i18n）と
 * props（user/onLogout）で完結させ、features/auth(flat) への越境 import を避ける。
 *
 * スコープ: プロフィール（ニックネーム編集・ユーザーID）＋設定（テーマ/言語/
 * サポート/プライバシー）＋ログアウト。メール/パスワード変更と執筆統計は PC の
 * auth ユーティリティに依存するため SP v1 では持たない（PC 品質＝過剰にしない）。
 */
export function SpAccountPage({ user, onLogout }: SpAccountPageProps) {
  const t = useTranslations('account');
  const displayName = user.nickname ?? user.name ?? user.email.split('@')[0];
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <div
      {...verifyAttrs({ unit: 'SpAccountPage', hasAvatar: Boolean(user.avatarUrl) })}
      className="flex h-full flex-col overflow-auto bg-[var(--bg)] text-[var(--fg)]"
    >
      <header className="px-5 pt-6 pb-2 text-lg font-medium">{t('section.profile')}</header>

      {/* ── Profile ── */}
      <section className="px-5 py-3">
        <div className="mb-5 flex items-center gap-4">
          {user.avatarUrl ? (
            // biome-ignore lint/performance/noImgElement: external avatar URL
            <img
              src={user.avatarUrl}
              alt=""
              className="h-14 w-14 rounded-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span
              className="flex h-14 w-14 items-center justify-center rounded-full text-xl font-bold text-white"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              {initials}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-base font-medium">{displayName}</p>
            <p className="truncate text-sm opacity-60">{user.email}</p>
          </div>
        </div>

        <NicknameField initialValue={user.nickname ?? ''} />

        <div className="mt-4">
          <p className="mb-1 text-xs uppercase tracking-[0.1em] opacity-50">{t('field.user_id')}</p>
          <p className="font-mono text-xs opacity-60">{user.id}</p>
        </div>
      </section>

      <Divider />

      {/* ── Settings ── */}
      <section className="px-5 py-3">
        <h2 className="mb-4 text-sm font-medium opacity-70">{t('section.settings')}</h2>
        <div className="flex flex-col gap-5">
          <ThemeRow />
          <LanguageRow />

          {/* 使い方・プライバシーポリシーは公開サイト（別ドメイン）にある */}
          <a
            href={docsHref('/support')}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm"
            style={{ color: 'var(--accent)' }}
          >
            {t('links.support')} →
          </a>
          <a
            href={docsHref('/privacy')}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm"
            style={{ color: 'var(--accent)' }}
          >
            {t('links.privacy')} →
          </a>
        </div>
      </section>

      <Divider />

      {/* ── Logout ── */}
      <section className="px-5 py-4 pb-8">
        <button
          type="button"
          onClick={onLogout}
          className="w-full rounded-lg border border-[color-mix(in_srgb,var(--fg)_16%,transparent)] py-3 text-sm font-medium text-red-500"
        >
          {t('logout.button')}
        </button>
      </section>
    </div>
  );
}

function Divider() {
  return <div className="mx-5 h-px" style={{ backgroundColor: 'var(--border-subtle)' }} />;
}

/** ニックネームのインライン編集（PC の EditableField 相当を SP 向けに簡素化）。 */
function NicknameField({ initialValue }: { initialValue: string }) {
  const t = useTranslations('account');
  const { updateProfile } = useAccountApi();
  const [value, setValue] = useState(initialValue);
  const [draft, setDraft] = useState(initialValue);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (draft === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError(null);
    const result = await updateProfile('nickname', draft);
    if (!result.ok) {
      setError(
        result.kind === 'unauthenticated' ? t('profile.error_login_required') : result.error,
      );
      setSaving(false);
      return;
    }
    setValue(draft);
    setEditing(false);
    setSaving(false);
  }

  return (
    <div>
      <p className="mb-1 text-xs uppercase tracking-[0.1em] opacity-50">{t('field.nickname')}</p>
      {editing ? (
        <div className="flex items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label={t('field.nickname')}
            className="flex-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg)] px-2 py-1.5 text-sm outline-none"
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="text-xs font-medium disabled:opacity-50"
            style={{ color: 'var(--accent)' }}
          >
            {saving ? '...' : t('field.save')}
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setDraft(value);
              setError(null);
            }}
            className="text-xs opacity-60"
          >
            {t('field.cancel')}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <p className="text-sm">{value || '-'}</p>
          <button type="button" onClick={() => setEditing(true)} className="text-xs opacity-60">
            {t('field.edit')}
          </button>
        </div>
      )}
      {error ? <p className="mt-1 text-xs text-red-500">{error}</p> : null}
    </div>
  );
}

function ThemeRow() {
  const t = useTranslations('account');
  const { theme, toggle } = useTheme();
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="mb-1 text-xs uppercase tracking-[0.1em] opacity-50">{t('theme.label')}</p>
        <p className="text-sm">{theme === 'light' ? t('theme.light') : t('theme.dark')}</p>
      </div>
      <button
        type="button"
        onClick={toggle}
        className="rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-xs font-medium"
        style={{ color: 'var(--accent)' }}
      >
        {t('theme.toggle')}
      </button>
    </div>
  );
}

function LanguageRow() {
  const t = useTranslations('account');
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value;
    if (!isLocale(next) || next === locale) return;
    startTransition(() => {
      setLocaleAction(next);
    });
  }

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="mb-1 text-xs uppercase tracking-[0.1em] opacity-50">{t('language.label')}</p>
        <p className="text-sm">{LOCALE_LABELS[locale] ?? locale}</p>
      </div>
      <select
        value={locale}
        onChange={handleChange}
        disabled={isPending}
        aria-label={t('language.label')}
        className="rounded-lg border border-[var(--border-subtle)] bg-transparent px-3 py-1.5 text-xs font-medium disabled:opacity-50"
        style={{ color: 'var(--accent)' }}
      >
        {LOCALE_OPTIONS.map((option) => (
          <option key={option.locale} value={option.locale}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
