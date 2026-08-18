'use client';

import { QuestionsRouteLoading } from '../_loading/questions-route-loading';

/** `/questions` の遷移ローディング。作成フォーム ＋ タイムラインの枠を出す。 */
export default function Loading() {
  return <QuestionsRouteLoading />;
}
