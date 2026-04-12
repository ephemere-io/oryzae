'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import type { UserProfile } from '../hooks/use-user-detail';

function formatDate(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getInitials(email: string): string {
  return email.slice(0, 2).toUpperCase();
}

export function UserProfileHeader({ profile }: { profile: UserProfile }) {
  return (
    <div className="flex items-center gap-5">
      <Avatar className="h-14 w-14">
        <AvatarFallback className="text-lg">{getInitials(profile.email)}</AvatarFallback>
      </Avatar>
      <div className="space-y-1">
        <h2 className="text-xl font-medium">{profile.email}</h2>
        <p className="text-xs text-muted-foreground font-mono">{profile.id}</p>
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span>
            Registered{' '}
            <span className="font-mono text-foreground">{formatDate(profile.createdAt)}</span>
          </span>
          <span>
            Last login{' '}
            <span className="font-mono text-foreground">{formatDate(profile.lastSignInAt)}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
