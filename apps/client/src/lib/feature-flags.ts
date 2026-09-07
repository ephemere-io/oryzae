'use client';

import { useFeatureFlagEnabled } from 'posthog-js/react';
import { useEffect, useState } from 'react';

/**
 * 段階リリース用の機能フラグ（`docs/oryzae-study/50-rollout.md`）。
 *
 * リポジトリにフラグの仕組みが無かったので、既にある 2 つを組み合わせる:
 *  - `NEXT_PUBLIC_*` … ビルド単位の配信元（既定 off）
 *  - PostHog … 段階配信（10% → 50% → 100%）
 * これに `?flag=on|off|auto` の手動切替を足す。レビューと不具合報告のために、
 * 配信の当落に関わらず自分で切り替えられる必要がある。
 *
 * **手動切替は env と PostHog の両方より優先する。** プレビュー環境に env を置かなくても
 * `?flag=on` だけで確認できる（env の Preview scope は全ブランチに効くので、
 * 1 つの PR のために置くと他の PR まで巻き込む）。裏返せば、env が off でも
 * 「フラグの中身が絶対に実行されない」わけではない — 切替を付けた人には出る。
 *
 * ここはドメインを知らない横断インフラなので lib に置く。どのフラグをどう組むかは
 * 呼び出し側（features）が決める。
 */
export interface FeatureFlagOptions {
  /** PostHog のフラグキー。 */
  key: string;
  /** ビルド単位の配信元。手動切替が無いときの既定値になる（切替はこれより優先）。 */
  envEnabled: boolean;
  /** `?<queryParam>=on|off|auto` で手動切替する（`auto` は切替を捨てて配信へ戻す）。 */
  queryParam: string;
  /** 手動切替を憶えておく localStorage のキー。 */
  storageKey: string;
}

type Override = boolean | null;

/**
 * URL が指示していること。`null` は「指示なし」、`'clear'` は「憶えた切替を捨てる」。
 *
 * `'clear'` を `null` と分けるのは、**入る道だけあって出る道が無い切替を作らない**ため。
 * `?flag=off` は「off に固定」を憶えるだけなので、それだけでは配信の対象に戻れない
 * （env を on にしても PostHog で配っても、その端末には出ない）。段階リリースの数字を
 * 見る設計なら、レビューした端末が全部その状態のままなのは困る。
 */
type QuerySignal = Override | 'clear';

/**
 * フラグの現在値と、それを信用してよいか。
 *
 * 手動切替（URL / localStorage）はブラウザにしか無いので、**初回レンダーでは読めない**。
 * `enabled` だけを返すと、呼び出し側は「まだ読めていない false」と「本当に off」を
 * 区別できず、解決前にリダイレクトのような後戻りできない判断をしてしまう。
 */
export interface FeatureFlagState {
  enabled: boolean;
  /** 手動切替を読み終えたか。false の間は `enabled` で分岐しないこと。 */
  resolved: boolean;
}

/** localStorage は private mode や容量超過で throw しうる。切替は補助なので握る。 */
function readStoredOverride(storageKey: string): Override {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (raw === 'on') return true;
    if (raw === 'off') return false;
    return null;
  } catch {
    return null;
  }
}

function writeStoredOverride(storageKey: string, value: Override): void {
  if (typeof window === 'undefined') return;
  try {
    if (value === null) window.localStorage.removeItem(storageKey);
    else window.localStorage.setItem(storageKey, value ? 'on' : 'off');
  } catch {
    // 憶えられなくても、その場の切替は効く。
  }
}

/**
 * `?flag=on|off` を読む。
 *
 * `useSearchParams()` は使わない。あれを使うと呼び出し側に Suspense 境界が要るように
 * なり、`/` の振り分けゲートのような「描画を持たない client 専用コンポーネント」に
 * まで境界を足すことになる。ここで欲しいのは URL の生の値だけなので window で足りる。
 */
function readQueryOverride(queryParam: string): QuerySignal {
  if (typeof window === 'undefined') return null;
  const value = new URLSearchParams(window.location.search).get(queryParam);
  if (value === 'on') return true;
  if (value === 'off') return false;
  if (value === 'auto') return 'clear';
  return null;
}

/**
 * フラグの現在値。
 *
 * 手動切替（URL / localStorage）があればそれが**最優先**。無ければ「ビルドが有効」かつ
 * 「PostHog が明示的に false を返していない」とき有効。PostHog は読み込み前 `undefined` を返すので、
 * `!== false` にして「まだ分からない」を off に倒さない（フラグ ON の環境で
 * 一瞬だけ従来画面が出るのを防ぐ）。
 */
export function useFeatureFlag(options: FeatureFlagOptions): FeatureFlagState {
  const posthogEnabled = useFeatureFlagEnabled(options.key);

  // SSR では URL も localStorage も読めない。マウント後に確定させる。
  const [state, setState] = useState<{ override: Override; resolved: boolean }>({
    override: null,
    resolved: false,
  });

  useEffect(() => {
    const fromQuery = readQueryOverride(options.queryParam);
    if (fromQuery !== null) {
      // `?flag=auto` は憶えた切替を捨てて、env / PostHog の配信に戻す。
      const override = fromQuery === 'clear' ? null : fromQuery;
      // URL で切り替えたら憶える。リロードや画面遷移のたびに付け直さなくて済む。
      writeStoredOverride(options.storageKey, override);
      setState({ override, resolved: true });
      return;
    }
    setState({ override: readStoredOverride(options.storageKey), resolved: true });
  }, [options.queryParam, options.storageKey]);

  const enabled =
    state.override !== null ? state.override : options.envEnabled && posthogEnabled !== false;

  return { enabled, resolved: state.resolved };
}

/** `NEXT_PUBLIC_*` の文字列を真偽に。既定は off。 */
export function isEnvFlagOn(value: string | undefined): boolean {
  return value === 'on' || value === 'true' || value === '1';
}
