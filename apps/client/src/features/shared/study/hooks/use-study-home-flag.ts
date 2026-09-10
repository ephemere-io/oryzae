'use client';

import { type FeatureFlagState, isEnvFlagOff, useFeatureFlag } from '@/lib/feature-flags';

/** PostHog のフラグキー（`docs/oryzae-study/50-rollout.md`）。 */
const FLAG_KEY = 'study-home';

/** `?study=on` / `?study=off` / `?study=auto`（切替を捨てる）で手動切替する。 */
const QUERY_PARAM = 'study';

const STORAGE_KEY = 'oryzae_study_home';

/**
 * 書斎ホームを出すか。**既定で全員に出す**（2026-09 に既定 off から切り替えた）。
 *
 * 「環境変数をオンにしなくても、全部書斎モードにしたい」（オーナーの判断）。env を
 * 置かなくても出る。PostHog も見ない — PostHog はフラグが無いときや配信の対象外の
 * ときも false を返すので、見ていると PostHog 側の設定しだいで全員が黙って off に戻る。
 *
 * **撤退は `NEXT_PUBLIC_STUDY_HOME=off` を入れて再デプロイするだけ。** 端末ごとの
 * `?study=on|off` の手動切替は残っていて、env より優先する。`?study=off` を触った端末は
 * 憶えたままなので、既定に戻すには `?study=auto` を開く（切替を捨てる）。
 *
 * `resolved` が false の間は `enabled` で分岐しないこと。手動切替はブラウザにしか
 * 無いので初回レンダーでは読めず、その一瞬を「off」と読むとリダイレクトのような
 * 後戻りできない判断を誤る。
 */
export function useStudyHome(): FeatureFlagState {
  return useFeatureFlag({
    key: FLAG_KEY,
    envEnabled: !isEnvFlagOff(process.env.NEXT_PUBLIC_STUDY_HOME),
    respectPosthog: false,
    queryParam: QUERY_PARAM,
    storageKey: STORAGE_KEY,
  });
}
