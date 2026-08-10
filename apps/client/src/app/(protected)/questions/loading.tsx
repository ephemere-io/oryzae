'use client';

import { QuestionsRouteSkeleton } from '../_skeletons/questions-route-skeleton';

/** `/questions` の遷移ローディング。作成フォーム ＋ タイムラインの枠を出す。 */
export default function Loading() {
  return <QuestionsRouteSkeleton />;
}
