# 50 — 段階リリース

## フラグ

リポジトリに機能フラグの仕組みは無い（`NEXT_PUBLIC_*` は SITE_URL / DOCS_SITE_URL /
POSTHOG_KEY のみ）。PostHog は入っているので、2段構えにする。

```ts
// lib/study-flag.ts
export function useStudyHome(): boolean {
  const env = process.env.NEXT_PUBLIC_STUDY_HOME === 'on';       // ビルド単位の大元
  const ph = useFeatureFlagEnabled('study-home');                 // PostHog で段階配信
  const override = useLocalOverride('oryzae_study_home');         // ?study=on / localStorage
  return override ?? (env && ph !== false);
}
```

- `NEXT_PUBLIC_STUDY_HOME` 既定 `off`。off なら書斎のコードは一切実行されない（dynamic import も走らない）。
- PostHog フラグ `study-home` で Research Preview の一部にだけ配る。
- `?study=on` / `?study=off` で自分で切り替えられるようにする（レビューと不具合報告のため）。

## 手順

1. **Preview 環境で内部確認** — Vercel preview に `NEXT_PUBLIC_STUDY_HOME=on`。
   `?study=off` で従来のサイドバー版に戻れることも確認する。
2. **本番に置くがフラグ off** — コードだけ入れる。バンドル差分（three.js が入っていないこと）を確認。
3. **自分たちだけ on** — PostHog で内部アカウントに限定。1週間。
   見るもの: 書斎からの離脱率、`/entries/new` への到達率、WebGL フォールバック発生率、
   低スペック端末での fps。
4. **10% → 50% → 100%** — 各段で「書斎を開いてから何も押さずに離脱」の割合を見る。
   ここが従来より悪化したら、入口の分かりにくさ（何が押せるのか）が原因。ホバー以外の
   手掛かり（初回だけ出る小さなラベル）を検討する。
5. **サイドバー撤廃の確定** — 100% 到達後、2週間おいてから `Sidebar` と
   `SIDEBAR_WIDTH` の分岐を削除。それまでは残す。

## フォールバック

| 条件 | 挙動 |
| --- | --- |
| WebGL 非対応 | 書斎の静止表現（SVG 1枚）を入口にする。3つの対象は `<a>` でリンク |
| `prefers-reduced-motion` | カメラ移動と開くアニメーションを飛ばし、クロスフェードのみ |
| 初回描画が 2s 以上かかる | 書斎を諦めて `/entries/new` へ送る（`StudyFallback` から自動遷移） |
| データ取得失敗 | その要素だけ空で出す。書斎自体は表示する |

## 撤退

`NEXT_PUBLIC_STUDY_HOME=off` を入れて再デプロイするだけで元に戻る（1〜5 のコミットは
画面に出ないため残しても無害）。緊急時は PostHog フラグを切るだけでも止まる。
