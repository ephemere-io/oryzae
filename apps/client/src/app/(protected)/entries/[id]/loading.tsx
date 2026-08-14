'use client';

import { EntryEditorRouteSkeleton } from '../../_skeletons/entry-editor-route-skeleton';

/** `/entries/[id]` の遷移ローディング。既存エントリなので本文と漬け込み CTA の枠も出す。 */
export default function Loading() {
  return <EntryEditorRouteSkeleton existing />;
}
