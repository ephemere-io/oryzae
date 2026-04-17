'use client';

import { useState } from 'react';
import { createApiClient } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { WritingStats } from './writing-stats';

interface AccountPageProps {
  user: {
    id: string;
    email: string;
    nickname: string | null;
    avatarUrl: string | null;
    name: string | null;
  };
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
      <p
        className="mb-1 text-xs font-medium uppercase tracking-[0.1em]"
        style={{ color: 'var(--date-color)', fontFamily: 'Inter, sans-serif' }}
      >
        {label}
      </p>
      {editing ? (
        <div className="flex items-center gap-2">
          <input
            type={type}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="flex-1 rounded-md border px-2 py-1 text-sm focus:outline-none focus:ring-1"
            style={{
              borderColor: 'var(--border-subtle)',
              backgroundColor: 'var(--bg)',
              color: 'var(--fg)',
            }}
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

export function AccountPage({ user }: AccountPageProps) {
  const displayName = user.nickname ?? user.name ?? user.email.split('@')[0];
  const initials = displayName.charAt(0).toUpperCase();

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

  async function updatePassword(newPassword: string): Promise<string | null> {
    const token = getAccessToken();
    if (!token) return 'ログインが必要です';

    const api = createApiClient(token);
    const res = await api.fetch('/api/v1/auth/update-password', {
      method: 'POST',
      body: JSON.stringify({ accessToken: token, password: newPassword }),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error: string };
      return data.error;
    }
    return null;
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1
        className="mb-8 text-xs font-semibold uppercase tracking-[0.2em]"
        style={{ color: 'var(--accent)', fontFamily: 'Inter, sans-serif' }}
      >
        Account
      </h1>

      {/* Avatar + Name */}
      <div className="mb-8 flex items-center gap-4">
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

      {/* Profile fields */}
      <div className="flex flex-col gap-5">
        <EditableField
          label="ニックネーム"
          value={user.nickname ?? ''}
          onSave={(val) => updateProfile('nickname', val)}
        />
        <EditableField
          label="メールアドレス"
          value={user.email}
          type="email"
          onSave={() => Promise.resolve('メールアドレスの変更はサポートに連絡してください')}
        />
        <EditableField
          label="パスワード"
          value="••••••••"
          type="password"
          onSave={updatePassword}
        />
        <div>
          <p
            className="mb-1 text-xs font-medium uppercase tracking-[0.1em]"
            style={{ color: 'var(--date-color)', fontFamily: 'Inter, sans-serif' }}
          >
            ユーザーID
          </p>
          <p className="font-mono text-xs" style={{ color: 'var(--date-color)' }}>
            {user.id}
          </p>
        </div>
      </div>

      {/* Divider */}
      <div className="my-8 h-px" style={{ backgroundColor: 'var(--border-subtle)' }} />

      {/* Writing Statistics */}
      <h2
        className="mb-6 text-xs font-semibold uppercase tracking-[0.2em]"
        style={{ color: 'var(--accent)', fontFamily: 'Inter, sans-serif' }}
      >
        Writing Stats
      </h2>
      <WritingStats />
    </div>
  );
}
