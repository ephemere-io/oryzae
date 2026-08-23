'use client';

import { useSearchParams } from 'next/navigation';
import { JarRouteLoading } from '../_loading/jar-route-loading';

/**
 * `/jar` の遷移ローディング。
 *
 * 例外: 漬け込み（`/jar?justPickled=1`）への遷移はそれ自体が専用の演出アニメで覆われる。
 * ここで枠を出すと演出に重なって途切れて見えるので、この遷移のときだけ何も描かない
 * （遷移の表現は演出アニメ側に委ねる）。マーカーは漬け込み専用の既存クエリを再利用する。
 */
export default function Loading() {
  const params = useSearchParams();
  if (params.get('justPickled')) return null;
  return <JarRouteLoading />;
}
