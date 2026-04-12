'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAdminAuth } from '../hooks/use-admin-auth';

export function AdminLoginForm() {
  const { login } = useAdminAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const err = await login(email, password);
    if (err) {
      setError(err);
      setSubmitting(false);
    } else {
      router.push('/dashboard');
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#09090b]">
      {/* Subtle radial gradient */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(255,255,255,0.03)_0%,_transparent_70%)]" />

      <div className="relative z-10 w-full max-w-[360px] px-4">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mb-3 text-[13px] text-[#71717a]">&#9670;</div>
          <h1 className="text-xl font-semibold tracking-tight text-[#ececef]">Oryzae Admin</h1>
          <p className="mt-1.5 text-[13px] text-[#52525b]">管理者アカウントでログイン</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-500/10 px-3 py-2 text-[13px] text-red-400">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-[13px] text-[#a1a1aa]">
              メールアドレス
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="admin@example.com"
              className="h-9 border-[#1f1f24] bg-[#0f0f12] text-[13px] text-[#ececef] placeholder:text-[#3f3f46] focus-visible:ring-[#3f3f46]"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-[13px] text-[#a1a1aa]">
              パスワード
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="h-9 border-[#1f1f24] bg-[#0f0f12] text-[13px] text-[#ececef] placeholder:text-[#3f3f46] focus-visible:ring-[#3f3f46]"
            />
          </div>

          <Button
            type="submit"
            disabled={submitting}
            className="mt-2 h-9 w-full bg-[#ececef] text-[13px] font-medium text-[#09090b] hover:bg-[#d4d4d8] disabled:opacity-50"
          >
            {submitting ? 'ログイン中...' : 'ログイン'}
          </Button>
        </form>
      </div>
    </div>
  );
}
