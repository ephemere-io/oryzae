'use client';

import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useDeleteUser } from '../hooks/use-delete-user';

// Issue #326: テストアカウントとその関連データを一括削除する管理者向け UI。
// 一覧画面 (/users) ではなくユーザー詳細画面 (/users/[id]) にだけ置く。
// 一括削除は致命的なヒューマンエラーを生みかねないため、複数選択削除は実装しない。

interface Props {
  userId: string;
  email: string;
}

export function DeleteUserPanel({ userId, email }: Props) {
  const router = useRouter();
  const { deleteUser, loading, error, reset } = useDeleteUser();
  const [open, setOpen] = useState(false);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) reset();
  };

  const handleConfirm = async () => {
    const ok = await deleteUser(userId);
    if (ok) {
      setOpen(false);
      router.push('/users');
    }
  };

  return (
    <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-3">
      <h4 className="text-xs font-medium uppercase tracking-wider text-destructive">危険な操作</h4>
      <p className="text-xs text-muted-foreground">
        このユーザーアカウントと、エントリ・問い・発酵結果・ボード・プロフィール・アバター画像など
        全ての関連データを完全に削除します。元に戻すことはできません。
      </p>
      <Button
        variant="destructive"
        size="sm"
        onClick={() => handleOpenChange(true)}
        disabled={loading}
      >
        <Trash2 className="mr-1.5 h-3 w-3" />
        このユーザーアカウントと関連データを一括削除する
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>本当に削除しますか？</DialogTitle>
            <DialogDescription>
              <span className="font-mono">{email || userId}</span>{' '}
              のアカウントと、エントリ・問い・発酵結果・ボード・プロフィール・アバター画像など
              全ての関連データを完全に削除します。この操作は取り消せません。
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenChange(false)}
              disabled={loading}
            >
              キャンセル
            </Button>
            <Button variant="destructive" size="sm" onClick={handleConfirm} disabled={loading}>
              <Trash2 className={`mr-1.5 h-3 w-3 ${loading ? 'animate-pulse' : ''}`} />
              {loading ? '削除中...' : '削除する'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
