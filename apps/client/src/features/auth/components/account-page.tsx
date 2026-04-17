'use client';

import { useState } from 'react';
import { translateAuthError } from '@/features/auth/utils/error-messages';
import { createApiClient } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { useTheme } from '@/lib/theme-context';
import { WritingStats } from './writing-stats';

interface AccountPageProps {
  user: {
    id: string;
    email: string;
    nickname: string | null;
    avatarUrl: string | null;
    name: string | null;
    providers: string[];
  };
  onLogout: () => void;
}

const labelClass = 'mb-1 text-[10px] font-medium uppercase tracking-[0.1em]';
const labelStyle = { color: 'var(--date-color)', fontFamily: 'Inter, sans-serif' };
const inputClass = 'w-full rounded-md border px-2 py-1 text-sm focus:outline-none focus:ring-1';
const inputStyle = {
  borderColor: 'var(--border-subtle)',
  backgroundColor: 'var(--bg)',
  color: 'var(--fg)',
};
const sectionHeadingClass = 'mb-6 text-xs font-semibold uppercase tracking-[0.2em]';
const sectionHeadingStyle = { color: 'var(--accent)', fontFamily: 'Inter, sans-serif' };

const SECTIONS = [
  { id: 'profile', label: 'プロフィール' },
  { id: 'security', label: 'セキュリティ' },
  { id: 'stats', label: '統計' },
  { id: 'settings', label: '設定' },
];

function SectionNav() {
  function handleClick(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <nav className="mb-10 flex flex-wrap gap-4">
      {SECTIONS.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => handleClick(s.id)}
          className="text-[10px] font-medium uppercase tracking-[0.1em] transition-colors hover:text-[var(--accent)]"
          style={{ color: 'var(--date-color)', fontFamily: 'Inter, sans-serif' }}
        >
          {s.label}
        </button>
      ))}
    </nav>
  );
}

function EditableField({
  label,
  value,
  onSave,
  type = 'text',
}: {
  label: string;
  value: string;
  onSave: (val: string) => Promise<string | null>;
  type?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (draft === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError(null);
    const err = await onSave(draft);
    if (err) {
      setError(err);
    } else {
      setEditing(false);
    }
    setSaving(false);
  }

  return (
    <div>
      <p className={labelClass} style={labelStyle}>
        {label}
      </p>
      {editing ? (
        <div className="flex items-center gap-2">
          <input
            type={type}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className={`flex-1 ${inputClass}`}
            style={inputStyle}
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="text-xs font-medium"
            style={{ color: 'var(--accent)' }}
          >
            {saving ? '...' : '保存'}
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setDraft(value);
              setError(null);
            }}
            className="text-xs"
            style={{ color: 'var(--date-color)' }}
          >
            取消
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <p className="text-sm" style={{ color: 'var(--fg)' }}>
            {value || '-'}
          </p>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs"
            style={{ color: 'var(--date-color)' }}
          >
            編集
          </button>
        </div>
      )}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

function EmailChangeSection({ email, isOAuthOnly }: { email: string; isOAuthOnly: boolean }) {
  const [editing, setEditing] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const token = getAccessToken();
    if (!token) {
      setError('ログインが必要です');
      setSaving(false);
      return;
    }

    const api = createApiClient(token);
    const res = await api.fetch('/api/v1/auth/change-email', {
      method: 'POST',
      body: JSON.stringify({ newEmail }),
    });

    if (!res.ok) {
      const data = (await res.json()) as { error: string };
      setError(translateAuthError(data.error));
      setSaving(false);
      return;
    }

    setSuccess(true);
    setSaving(false);
  }

  return (
    <div>
      <p className={labelClass} style={labelStyle}>
        メールアドレス
      </p>
      {isOAuthOnly ? (
        <div>
          <p className="text-sm" style={{ color: 'var(--fg)' }}>
            {email}
          </p>
          <p className="mt-1 text-xs" style={{ color: 'var(--date-color)' }}>
            Google アカウントに紐づいたメールアドレスです
          </p>
        </div>
      ) : success ? (
        <div>
          <p className="text-sm" style={{ color: 'var(--fg)' }}>
            {email}
          </p>
          <p className="mt-1 text-xs" style={{ color: 'var(--accent)' }}>
            確認メールを送信しました。新しいメールアドレスに届いたメールのリンクをクリックしてください。
          </p>
        </div>
      ) : editing ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            required
            placeholder="新しいメールアドレス"
            className={inputClass}
            style={inputStyle}
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="text-xs font-medium"
              style={{ color: 'var(--accent)' }}
            >
              {saving ? '...' : '送信'}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setNewEmail('');
                setError(null);
              }}
              className="text-xs"
              style={{ color: 'var(--date-color)' }}
            >
              取消
            </button>
          </div>
        </form>
      ) : (
        <div className="flex items-center gap-2">
          <p className="text-sm" style={{ color: 'var(--fg)' }}>
            {email}
          </p>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs"
            style={{ color: 'var(--date-color)' }}
          >
            変更
          </button>
        </div>
      )}
    </div>
  );
}

function PasswordChangeSection({ isOAuthOnly }: { isOAuthOnly: boolean }) {
  const [editing, setEditing] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (isOAuthOnly) return null;

  function resetForm() {
    setEditing(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
    setSuccess(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError('新しいパスワードが一致しません');
      return;
    }

    setSaving(true);

    const token = getAccessToken();
    if (!token) {
      setError('ログインが必要です');
      setSaving(false);
      return;
    }

    const api = createApiClient(token);
    const res = await api.fetch('/api/v1/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    if (!res.ok) {
      const data = (await res.json()) as { error: string };
      setError(translateAuthError(data.error));
      setSaving(false);
      return;
    }

    setSuccess(true);
    setSaving(false);
    setTimeout(() => resetForm(), 2000);
  }

  return (
    <div>
      <p className={labelClass} style={labelStyle}>
        パスワード
      </p>
      {success ? (
        <p className="text-xs" style={{ color: 'var(--accent)' }}>
          パスワードを更新しました
        </p>
      ) : editing ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            placeholder="現在のパスワード"
            className={inputClass}
            style={inputStyle}
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={6}
            placeholder="新しいパスワード（6文字以上）"
            className={inputClass}
            style={inputStyle}
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
            placeholder="新しいパスワード（確認）"
            className={inputClass}
            style={inputStyle}
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="text-xs font-medium"
              style={{ color: 'var(--accent)' }}
            >
              {saving ? '...' : '更新'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="text-xs"
              style={{ color: 'var(--date-color)' }}
            >
              取消
            </button>
          </div>
        </form>
      ) : (
        <div className="flex items-center gap-2">
          <p className="text-sm" style={{ color: 'var(--fg)' }}>
            ••••••••
          </p>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs"
            style={{ color: 'var(--date-color)' }}
          >
            変更
          </button>
        </div>
      )}
    </div>
  );
}

function ThemeToggleSection() {
  const { theme, toggle } = useTheme();

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className={labelClass} style={labelStyle}>
          テーマ
        </p>
        <p className="text-sm" style={{ color: 'var(--fg)' }}>
          {theme === 'light' ? 'ライトモード' : 'ダークモード'}
        </p>
      </div>
      <button
        type="button"
        onClick={toggle}
        className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
        style={{
          color: 'var(--accent)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        {theme === 'light' ? (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5"
          >
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        ) : (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5"
          >
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
        )}
        切り替え
      </button>
    </div>
  );
}

function Divider() {
  return <div className="my-8 h-px" style={{ backgroundColor: 'var(--border-subtle)' }} />;
}

export function AccountPage({ user, onLogout }: AccountPageProps) {
  const displayName = user.nickname ?? user.name ?? user.email.split('@')[0];
  const initials = displayName.charAt(0).toUpperCase();
  const isOAuthOnly = user.providers.length > 0 && !user.providers.includes('email');

  async function updateProfile(field: string, value: string): Promise<string | null> {
    const token = getAccessToken();
    if (!token) return 'ログインが必要です';

    const api = createApiClient(token);
    const res = await api.fetch('/api/v1/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify({ [field]: value }),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error: string };
      return data.error;
    }
    return null;
  }

  return (
    <div className="mx-auto max-w-md px-6 py-12">
      {/* Page title */}
      <h1 className={sectionHeadingClass} style={sectionHeadingStyle}>
        Account
      </h1>

      {/* Section index nav */}
      <SectionNav />

      {/* ── Profile ── */}
      <section id="profile">
        <h2 className={sectionHeadingClass} style={sectionHeadingStyle}>
          プロフィール
        </h2>

        <div className="mb-6 flex items-center gap-4">
          {user.avatarUrl ? (
            // biome-ignore lint/performance/noImgElement: external avatar URL
            <img
              src={user.avatarUrl}
              alt=""
              className="h-16 w-16 rounded-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span
              className="flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold text-white"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              {initials}
            </span>
          )}
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--fg)' }}>
              {displayName}
            </p>
            <p className="text-xs" style={{ color: 'var(--date-color)' }}>
              {user.email}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <EditableField
            label="ニックネーム"
            value={user.nickname ?? ''}
            onSave={(val) => updateProfile('nickname', val)}
          />
          <div>
            <p className={labelClass} style={labelStyle}>
              ユーザーID
            </p>
            <p className="font-mono text-xs" style={{ color: 'var(--date-color)' }}>
              {user.id}
            </p>
          </div>
        </div>
      </section>

      <Divider />

      {/* ── Security ── */}
      <section id="security">
        <h2 className={sectionHeadingClass} style={sectionHeadingStyle}>
          セキュリティ
        </h2>
        <div className="flex flex-col gap-5">
          <EmailChangeSection email={user.email} isOAuthOnly={isOAuthOnly} />
          <PasswordChangeSection isOAuthOnly={isOAuthOnly} />
        </div>
      </section>

      <Divider />

      {/* ── Stats ── */}
      <section id="stats">
        <h2 className={sectionHeadingClass} style={sectionHeadingStyle}>
          統計
        </h2>
        <WritingStats />
      </section>

      <Divider />

      {/* ── Settings ── */}
      <section id="settings">
        <h2 className={sectionHeadingClass} style={sectionHeadingStyle}>
          設定
        </h2>
        <div className="flex flex-col gap-6">
          <ThemeToggleSection />

          <div>
            <p className={labelClass} style={labelStyle}>
              ログアウト
            </p>
            <button
              type="button"
              onClick={onLogout}
              className="mt-1 text-sm font-medium text-red-500 transition-colors hover:text-red-600"
            >
              ログアウトする
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
