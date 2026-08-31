'use client';

import { DeviceView } from '@/components/device-view';
import { EntryEditorSkeleton } from '@/features/pc/entries/components/entry-editor-skeleton';
import { SpEntryEditorSkeleton } from '@/features/sp/entries/components/sp-entry-editor-skeleton';

/**
 * `/entries/new` と `/entries/[id]` のロード表示。
 *
 * エディタは「chrome（ツールバー・問いリンカ・ステータスバー）＋ 本文」で、
 * **chrome は静的**（データを待たない）。だから chrome は枠を出す価値がある＝実物と
 * 同じ位置に同じ高さで置ける。分かれるのは本文:
 *
 * - `/entries/new` … 待つコンテンツが**無い**。本文は実際に空のまま書き始める画面なので、
 *   本文エリアは空で正しい。ここに偽の行や「読み込み中」を出すのは嘘になる。
 * - `/entries/[id]` … 本文は取得待ち。ただし書字方向（縦書き/横書き）は mount 後に
 *   localStorage とロケールで確定するため、**行の枠は置けない**（向きを決め打ちすると必ずズレる）。
 *   予告できない領域なので本文エリアだけ `PageLoading` にする。
 *
 * @param existing 既存エントリを開くルートか。
 */
export function EntryEditorRouteLoading({ existing = false }: { existing?: boolean }) {
  return (
    <DeviceView
      sp={<SpEntryEditorSkeleton bodyLines={existing ? 4 : 0} withPickleCta={existing} />}
      pc={<EntryEditorSkeleton chips={existing ? 1 : 0} bodyLoading={existing} />}
    />
  );
}
