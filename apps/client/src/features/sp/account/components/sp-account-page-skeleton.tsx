import { verifyAttrs } from '@oryzae/verify';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * SP アカウント（SpAccountPage）のスケルトン。
 *
 * PC の中央 2xl フォームとは別物で、SP は全幅・3ブロック
 * （プロフィール → 設定 → ログアウト）を細い罫線で区切る構成。セキュリティ欄・統計欄は無い。
 */

/** セクション区切り（実物: mx-5 h-px）。 */
function DividerSkeleton() {
  return <div className="mx-5 h-px" style={{ backgroundColor: 'var(--border-subtle)' }} />;
}

/** 「ラベル / 値」と右端のボタンが並ぶ設定行（実物: ThemeRow / LanguageRow）。 */
function SettingRowSkeleton() {
  return (
    <div className="flex items-center justify-between">
      <div>
        <Skeleton className="mb-1 h-3 w-16" />
        <Skeleton className="h-4 w-24" />
      </div>
      <Skeleton className="h-7 w-16 rounded-lg" />
    </div>
  );
}

export function SpAccountPageSkeleton() {
  return (
    <div
      className="flex h-full flex-col bg-[var(--bg)]"
      aria-hidden="true"
      {...verifyAttrs({ unit: 'SpAccountPageSkeleton', slots: 'header,profile,settings,logout' })}
    >
      {/* ヘッダ（実物: px-5 pt-6 pb-2 text-lg） */}
      <div className="px-5 pt-6 pb-2" data-skeleton-slot="header">
        <Skeleton className="h-[22px] w-24" />
      </div>

      {/* プロフィール（実物: px-5 py-3、アバター 56px ＋ 名前/メール、ニックネーム、ユーザーID） */}
      <section className="px-5 py-3" data-skeleton-slot="profile">
        <div className="mb-5 flex items-center gap-4">
          <Skeleton className="h-14 w-14 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-1.5 h-3.5 w-40" />
          </div>
        </div>
        <div>
          <Skeleton className="mb-1 h-3 w-20" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="mt-4">
          <Skeleton className="mb-1 h-3 w-16" />
          <Skeleton className="h-3 w-48" />
        </div>
      </section>

      <DividerSkeleton />

      {/* 設定（実物: px-5 py-3、見出し ＋ テーマ / 言語 / リンク2本） */}
      <section className="px-5 py-3" data-skeleton-slot="settings">
        <Skeleton className="mb-4 h-4 w-16" />
        <div className="flex flex-col gap-5">
          <SettingRowSkeleton />
          <SettingRowSkeleton />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-24" />
        </div>
      </section>

      <DividerSkeleton />

      {/* ログアウト（実物: px-5 py-4 pb-8、全幅ボタン py-3） */}
      <section className="px-5 py-4 pb-8" data-skeleton-slot="logout">
        <Skeleton className="h-[46px] w-full rounded-lg" />
      </section>
    </div>
  );
}
