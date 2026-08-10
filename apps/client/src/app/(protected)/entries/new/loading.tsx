'use client';

import { EntryEditorRouteSkeleton } from '../../_skeletons/entry-editor-route-skeleton';

/** `/entries/new` の遷移ローディング。新規なので本文も漬け込み CTA も無い枠を出す。 */
export default function Loading() {
  return <EntryEditorRouteSkeleton />;
}
