'use client';

import { DeviceView } from '@/components/device-view';
import { EntryEditorSkeleton } from '@/features/pc/entries/components/entry-editor-skeleton';
import { SpEntryEditorSkeleton } from '@/features/sp/entries/components/sp-entry-editor-skeleton';

/**
 * `/entries/new` と `/entries/[id]` のロード枠。エディタは page 側に chrome が無く
 * （page は DeviceView でエディタを出すだけ）、画面の形は feature 側が全部持つ。
 *
 * @param existing 既存エントリを開くルートか。新規は本文が空・漬け込み CTA も無いので、
 *   同じエディタでも出す枠が変わる（偽の本文行を出すと確実にズレる）。
 */
export function EntryEditorRouteSkeleton({ existing = false }: { existing?: boolean }) {
  return (
    <DeviceView
      sp={<SpEntryEditorSkeleton bodyLines={existing ? 4 : 0} withPickleCta={existing} />}
      pc={<EntryEditorSkeleton chips={existing ? 1 : 0} />}
    />
  );
}
