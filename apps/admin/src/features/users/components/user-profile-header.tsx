'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
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
    <Card>
      <CardContent>
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="text-lg">{getInitials(profile.email)}</AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">{profile.email}</h2>
            <p className="text-sm text-muted-foreground font-mono">{profile.id}</p>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <span>
                Registered: <span className="text-foreground">{formatDate(profile.createdAt)}</span>
              </span>
              <span>
                Last Login:{' '}
                <span className="text-foreground">{formatDate(profile.lastSignInAt)}</span>
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
