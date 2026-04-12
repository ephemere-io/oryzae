'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { UserEntryList } from '@/features/users/components/user-entry-list';
import { UserFermentationHistory } from '@/features/users/components/user-fermentation-history';
import { UserProfileHeader } from '@/features/users/components/user-profile-header';
import { UserQuestionList } from '@/features/users/components/user-question-list';
import { WritingHeatmap } from '@/features/users/components/writing-heatmap';
import { useUserDetail } from '@/features/users/hooks/use-user-detail';

export default function UserDetailPage() {
  const params = useParams();
  const userId = typeof params.id === 'string' ? params.id : '';
  const { data, loading, error } = useUserDetail(userId);

  if (loading) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Loading...</p>;
  }

  if (error || !data) {
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
