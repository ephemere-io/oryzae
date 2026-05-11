'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { FireFermentationPanel } from '@/features/users/components/fire-fermentation-panel';
import { UserEntryList } from '@/features/users/components/user-entry-list';
import { UserFermentationHistory } from '@/features/users/components/user-fermentation-history';
import { UserFermentationReadiness } from '@/features/users/components/user-fermentation-readiness';
import { UserProfileHeader } from '@/features/users/components/user-profile-header';
import { UserQuestionList } from '@/features/users/components/user-question-list';
import { WritingHeatmap } from '@/features/users/components/writing-heatmap';
import { useFermentationReadiness } from '@/features/users/hooks/use-fermentation-readiness';
import { useUserDetail } from '@/features/users/hooks/use-user-detail';

export default function UserDetailPage() {
  const params = useParams();
  const userId = typeof params.id === 'string' ? params.id : '';
  const { data, loading, error, refresh: refreshUserDetail } = useUserDetail(userId);
  const {
    data: readiness,
    loading: readinessLoading,
    error: readinessError,
    refresh: refreshReadiness,
  } = useFermentationReadiness(userId);

  // 初回ロードのみ全画面 Loading / Error を出す。
  // refresh (例: FireFermentationPanel が onCompleted で呼ぶ) 中はページごと
  // アンマウントすると panel の result state が消えてしまうため、データが既に
  // あるときは stale-while-revalidate でそのまま描画を続ける (issue #290 フォロー)。
  if (!data) {
    if (loading) {
      return <p className="text-sm text-muted-foreground py-8 text-center">Loading...</p>;
    }
    return (
      <div className="space-y-4">
        <Link href="/users">
          <Button variant="ghost" size="xs">
            <ArrowLeft className="mr-1 h-3 w-3" />
            Users
          </Button>
        </Link>
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error ?? 'User not found'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/users">
        <Button variant="ghost" size="xs">
          <ArrowLeft className="mr-1 h-3 w-3" />
          Users
        </Button>
      </Link>

      <UserProfileHeader profile={data.profile} />

      <UserFermentationReadiness
        readiness={readiness}
        loading={readinessLoading}
        error={readinessError}
      />

      <FireFermentationPanel
        userId={userId}
        questions={data.questions
          .filter((q) => !q.isArchived)
          .map((q) => ({ id: q.id, text: q.text }))}
        onCompleted={() => {
          // 発火後に履歴と readiness をリフレッシュ
          refreshUserDetail();
          refreshReadiness();
        }}
      />

      <WritingHeatmap entryDates={data.entryDates} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <UserEntryList entries={data.entries} />
          <UserQuestionList questions={data.questions} />
        </div>
        <div>
          <UserFermentationHistory fermentations={data.fermentations} />
        </div>
      </div>
    </div>
  );
}
