'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { FermentationDetailHeader } from '@/features/fermentations/components/fermentation-detail-header';
import { FermentationKeywords } from '@/features/fermentations/components/fermentation-keywords';
import { FermentationLetter } from '@/features/fermentations/components/fermentation-letter';
import { FermentationSnippets } from '@/features/fermentations/components/fermentation-snippets';
import { FermentationWorksheet } from '@/features/fermentations/components/fermentation-worksheet';
import { useFermentationDetail } from '@/features/fermentations/hooks/use-fermentation-detail';

export default function FermentationDetailPage() {
  const params = useParams();
  const fermentationId = typeof params.id === 'string' ? params.id : '';
  const { data, loading, error, retryFermentation } = useFermentationDetail(fermentationId);

  if (loading) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Loading...</p>;
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Link href="/fermentations">
          <Button variant="ghost" size="xs">
            <ArrowLeft className="mr-1 h-3 w-3" />
            Fermentations
          </Button>
        </Link>
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error ?? 'Fermentation not found'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/fermentations">
        <Button variant="ghost" size="xs">
          <ArrowLeft className="mr-1 h-3 w-3" />
          Fermentations
        </Button>
      </Link>

      <FermentationDetailHeader data={data} onRetry={retryFermentation} />

      {data.masked && (
        <div className="rounded-md border border-border/50 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          他のユーザーのジャーナリング内容はプライバシー保護のためマスクされています
        </div>
      )}

      {data.worksheet && <FermentationWorksheet worksheet={data.worksheet} />}

      <FermentationSnippets snippets={data.snippets} />

      {data.letter && <FermentationLetter letter={data.letter} />}

      <FermentationKeywords keywords={data.keywords} />
    </div>
  );
}
