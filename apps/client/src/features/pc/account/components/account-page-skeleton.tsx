import { verifyAttrs } from '@oryzae/verify';
import { Skeleton, skeletonKeys } from '@/components/ui/skeleton';

/**
 * PC アカウント（AccountPage）のスケルトン。
 *
 * アカウントは一覧でもキャンバスでもなく、**中央 2xl 幅の設定フォーム**
 * （タイトル → プロフィール → セキュリティ → 統計 → 設定 の4セクションを罫線で区切る）。
 * 一覧の行枠を出すと、読み込み完了時に幅も縦位置も変わる。
 */

/** セクション見出し（実物: mb-6 text-xs uppercase tracking-[0.2em]）。 */
function SectionHeadingSkeleton() {
  return <Skeleton className="mb-6 h-3 w-24" />;
}

/** セクション区切り（実物: my-8 h-px）。 */
function DividerSkeleton() {
  return <div className="my-8 h-px" style={{ backgroundColor: 'var(--border-subtle)' }} />;
}

/** ラベル ＋ 値の1項目（実物: labelClass の 12px ラベル ＋ 本文）。 */
function FieldSkeleton({ valueWidth = 'w-48' }: { valueWidth?: string }) {
  return (
    <div>
      <Skeleton className="mb-1 h-3 w-20" />
      <Skeleton className={`h-4 ${valueWidth}`} />
    </div>
  );
}

/**
 * @param isOAuthOnly OAuth のみのアカウント。実 AccountPage はこのときパスワード変更欄を
 *   出さない（`PasswordChangeSection` が null を返す）ので、枠も1項目減らす。
 *   クライアント遷移時は認証が解決済みなので、呼び出し側が実際の値を渡せる。
 */
export function AccountPageSkeleton({ isOAuthOnly = false }: { isOAuthOnly?: boolean }) {
  return (
    <div
      className="mx-auto max-w-2xl px-6 py-12"
      aria-hidden="true"
      {...verifyAttrs({
        unit: 'AccountPageSkeleton',
        slots: 'title,profile,security,stats,settings',
        isOAuthOnly,
      })}
    >
      {/* ページタイトル */}
      <div data-skeleton-slot="title">
        <SectionHeadingSkeleton />
      </div>

      {/* プロフィール: アバター ＋ 名前/メール ＋ ニックネーム ＋ ユーザーID */}
      <section data-skeleton-slot="profile">
        <SectionHeadingSkeleton />
        <div className="mb-6 flex items-center gap-4">
          <Skeleton className="h-16 w-16 shrink-0 rounded-full" />
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
        <div className="flex flex-col gap-5">
          <FieldSkeleton />
          <FieldSkeleton valueWidth="w-64" />
        </div>
      </section>

      <DividerSkeleton />

      {/* セキュリティ: メール変更 ＋（OAuth のみでなければ）パスワード変更 */}
      <section data-skeleton-slot="security">
        <SectionHeadingSkeleton />
        <div className="flex flex-col gap-5">
          <FieldSkeleton valueWidth="w-56" />
          {!isOAuthOnly && <FieldSkeleton valueWidth="w-40" />}
        </div>
      </section>

      <DividerSkeleton />

      {/* 統計 */}
      <section data-skeleton-slot="stats">
        <SectionHeadingSkeleton />
        <div className="flex gap-4">
          {skeletonKeys(3).map((k) => (
            <Skeleton key={k} className="h-16 flex-1 rounded-md" />
          ))}
        </div>
      </section>

      <DividerSkeleton />

      {/* 設定: テーマ / 言語 / リンク2本 / ログアウト */}
      <section data-skeleton-slot="settings">
        <SectionHeadingSkeleton />
        <div className="flex flex-col gap-6">
          <FieldSkeleton valueWidth="w-24" />
          <FieldSkeleton valueWidth="w-24" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-28" />
          <FieldSkeleton valueWidth="w-20" />
        </div>
      </section>
    </div>
  );
}
