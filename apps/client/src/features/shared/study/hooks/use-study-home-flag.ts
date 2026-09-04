'use client';

import { type FeatureFlagState, isEnvFlagOn, useFeatureFlag } from '@/lib/feature-flags';

/** PostHog のフラグキー（`docs/oryzae-study/50-rollout.md`）。 */
const FLAG_KEY = 'study-home';

/** `?study=on` / `?study=off` で手動切替する。 */
const QUERY_PARAM = 'study';

const STORAGE_KEY = 'oryzae_study_home';

/**
 * 書斎ホームを出すか。
 *
 * `NEXT_PUBLIC_STUDY_HOME` の既定は off。off の間は書斎のコードが一切実行されず、
 * three.js の dynamic import も走らない（`/jar` を直接開いた人に 600KB を配らない）。
 *
 * **撤退はこのフラグを off にして再デプロイするだけ。** 緊急時は PostHog を切っても
 * 止まる（ただし手動切替をした端末は on のまま。レビュー用の逃げ道として意図的）。
 *
 * `resolved` が false の間は `enabled` で分岐しないこと。手動切替はブラウザにしか
 * 無いので初回レンダーでは読めず、その一瞬を「off」と読むとリダイレクトのような
 * 後戻りできない判断を誤る。
 */
export function useStudyHome(): FeatureFlagState {
  return useFeatureFlag({
    key: FLAG_KEY,
    envEnabled: isEnvFlagOn(process.env.NEXT_PUBLIC_STUDY_HOME),
    queryParam: QUERY_PARAM,
    storageKey: STORAGE_KEY,
  });
}
