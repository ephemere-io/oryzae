'use client';

import { useFeatureFlagEnabled } from 'posthog-js/react';
import { useEffect, useState } from 'react';

/**
 * 段階リリース用の機能フラグ（`docs/oryzae-study/50-rollout.md`）。
 *
 * リポジトリにフラグの仕組みが無かったので、既にある 2 つを組み合わせる:
 *  - `NEXT_PUBLIC_*` … ビルド単位の大元。off ならフラグの中身は一切実行されない
 *  - PostHog … 段階配信（10% → 50% → 100%）
 * これに `?flag=on|off` の手動切替を足す。レビューと不具合報告のために、
 * 配信の当落に関わらず自分で切り替えられる必要がある。
 *
 * ここはドメインを知らない横断インフラなので lib に置く。どのフラグをどう組むかは
 * 呼び出し側（features）が決める。
 */
export interface FeatureFlagOptions {
  /** PostHog のフラグキー。 */
  key: string;
  /** ビルド単位の大元。false ならフラグは常に off。 */
  envEnabled: boolean;
  /** `?<queryParam>=on|off` で手動切替する。 */
  queryParam: string;
  /** 手動切替を憶えておく localStorage のキー。 */
  storageKey: string;
}

type Override = boolean | null;

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
function readQueryOverride(queryParam: string): Override {
  if (typeof window === 'undefined') return null;
  const value = new URLSearchParams(window.location.search).get(queryParam);
  if (value === 'on') return true;
  if (value === 'off') return false;
  return null;
}

/**
 * フラグの現在値。
 *
 * 手動切替があればそれが最優先。無ければ「ビルドが有効」かつ「PostHog が明示的に
 * false を返していない」とき有効。PostHog は読み込み前 `undefined` を返すので、
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
      // URL で切り替えたら憶える。リロードや画面遷移のたびに付け直さなくて済む。
      writeStoredOverride(options.storageKey, fromQuery);
      setState({ override: fromQuery, resolved: true });
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
