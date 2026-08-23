'use client';

import { EntryEditorRouteLoading } from '../../_loading/entry-editor-route-loading';

/** `/entries/[id]` の遷移ローディング。既存エントリなので本文と漬け込み CTA の枠も出す。 */
export default function Loading() {
  return <EntryEditorRouteLoading existing />;
}
