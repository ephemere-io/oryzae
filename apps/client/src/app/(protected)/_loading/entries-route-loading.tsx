'use client';

import { DeviceView } from '@/components/device-view';
import { Skeleton } from '@/components/ui/skeleton';
import { EntryListSkeleton } from '@/features/pc/entries/components/entry-list-skeleton';
import { SpEntryListSkeleton } from '@/features/sp/entries/components/sp-entry-list-skeleton';

/**
 * `/entries` のロード枠。**page.tsx と同じ合成**にするのがこのファイルの役目:
 * page が「中央 680px の枠 ＋ ヘッダ行 ＋ EntryList」なら、ここも
 * 「中央 680px の枠 ＋ ヘッダ行の枠 ＋ EntryListSkeleton」を組む。
 * ページ chrome（ヘッダ行）は page.tsx が持つものなので枠もここに置き、
 * 一覧本体の形は feature 側の EntryListSkeleton が持つ。
 */
export function EntriesRouteLoading() {
  return (
    <DeviceView
      sp={<SpEntryListSkeleton />}
      pc={
        <div className="flex min-h-full flex-col">
          <div className="mx-auto w-full max-w-[680px] flex-1 px-6 pt-10 pb-20">
            {/* ヘッダ行（実物: "All Entries"(10px) と "+ New Entry"(px-5 py-2 の pill)） */}
            <div className="mb-8 flex items-center justify-between">
              <Skeleton className="h-2.5 w-20" />
              <Skeleton className="h-[34px] w-[124px] rounded-full" />
            </div>
            <EntryListSkeleton />
          </div>
        </div>
      }
    />
  );
}
