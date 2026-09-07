'use client';

import { type FeatureFlagState, isEnvFlagOn, useFeatureFlag } from '@/lib/feature-flags';

/** PostHog のフラグキー（`docs/oryzae-study/50-rollout.md`）。 */
const FLAG_KEY = 'study-home';

/** `?study=on` / `?study=off` / `?study=auto`（切替を捨てる）で手動切替する。 */
const QUERY_PARAM = 'study';

const STORAGE_KEY = 'oryzae_study_home';

/**
 * 書斎ホームを出すか。
 *
 * `NEXT_PUBLIC_STUDY_HOME` の既定は off。**配信としては** off の間、書斎のコードは
 * 実行されず three.js の dynamic import も走らない（`/jar` を直接開いた人に 600KB を
 * 配らない）。ただし `?study=on` を付けた端末には env に関わらず出る — 手動切替は
 * env と PostHog の両方より優先する。プレビューの確認はこれだけで足りる
 * （env の Preview scope は全ブランチに効くので、1 つの PR のために置かない）。
 *
 * **撤退はこのフラグを off にして再デプロイするだけ。** 緊急時は PostHog を切っても
 * 止まる。ただし `?study=on|off` を触った端末は憶えたままなので、配信に戻すには
 * `?study=auto` を開く（切替を捨てる）。
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
