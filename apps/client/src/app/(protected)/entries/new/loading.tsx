'use client';

import { EntryEditorRouteLoading } from '../../_loading/entry-editor-route-loading';

/** `/entries/new` の遷移ローディング。新規なので本文も漬け込み CTA も無い枠を出す。 */
export default function Loading() {
  return <EntryEditorRouteLoading />;
}
