'use client';

interface AccountPageProps {
  user: {
    id: string;
    email: string;
    avatarUrl: string | null;
    name: string | null;
  };
}

export function AccountPage({ user }: AccountPageProps) {
  const displayName = user.name ?? user.email.split('@')[0];
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <div className="mx-auto max-w-md px-6 py-12">
      <h1
        className="mb-8 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]"
        style={{ fontFamily: 'Inter, sans-serif' }}
      >
        Account
      </h1>

      {/* Avatar + Name */}
      <div className="mb-8 flex items-center gap-4">
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt=""
            className="h-16 w-16 rounded-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--accent)] text-xl font-bold text-white">
            {initials}
          </span>
        )}
        <div>
          <p className="text-sm font-medium text-[var(--fg)]">{displayName}</p>
          <p className="text-xs text-[var(--date-color)]">{user.email}</p>
        </div>
      </div>

      {/* Info fields */}
      <div className="flex flex-col gap-5">
        <div>
          <p
            className="mb-1 text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--date-color)]"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            名前
          </p>
          <p className="text-sm text-[var(--fg)]">{displayName}</p>
        </div>
        <div>
          <p
            className="mb-1 text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--date-color)]"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            メールアドレス
          </p>
          <p className="text-sm text-[var(--fg)]">{user.email}</p>
        </div>
        <div>
          <p
            className="mb-1 text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--date-color)]"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            ユーザーID
          </p>
          <p className="font-mono text-xs text-[var(--date-color)]">{user.id}</p>
        </div>
      </div>
    </div>
  );
}
