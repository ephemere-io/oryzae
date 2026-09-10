# 50 — 段階リリース

## フラグ

> **2026-09: 既定で全員に出すことにした。** `NEXT_PUBLIC_STUDY_HOME` は置かなくても on
> （`off` / `false` / `0` を入れたときだけ止まる）。PostHog は見ない — PostHog はフラグが
> 無いときや配信の対象外のときも false を返すので、見ていると PostHog 側の設定しだいで
> 全員が黙って off に戻る。端末ごとの `?study=on|off|auto` は残っていて env より優先する。
> 以下は段階配信で進めていたころの記録。

リポジトリに機能フラグの仕組みは無い（`NEXT_PUBLIC_*` は SITE_URL / DOCS_SITE_URL /
POSTHOG_KEY のみ）。PostHog は入っているので、2段構えにする。

```ts
// lib/feature-flags.ts + features/shared/study/hooks/use-study-home-flag.ts
const enabled = override !== null ? override : envEnabled && posthogEnabled !== false;
```

- `NEXT_PUBLIC_STUDY_HOME` 既定 `off`。**配信としては** off の間、書斎のコードは実行されず
  dynamic import も走らない。
- PostHog フラグ `study-home` で Research Preview の一部にだけ配る。
- `?study=on` / `?study=off` / `?study=auto` で自分で切り替えられる（レビューと不具合報告のため）。

**手動切替は env と PostHog の両方より優先する。** つまり env が off でも「フラグの中身が
絶対に実行されない」わけではなく、切替を付けた人には出る。裏返せば、**確認に環境変数は
要らない** — preview URL に `?study=on` を付ければよい。

`?study=auto` は憶えた切替を捨てて配信に戻す。これが無いと、レビューで一度でも
`?study=on|off` を触った端末が env と PostHog の配信から永久に外れ、手順 3〜4 で見る
コホートの数字が汚れる（`?study=off` は「off に固定」を憶えるだけで、解除ではない）。

## 手順

1. **Preview 環境で内部確認** — preview URL に **`?study=on`** を付けて開く。
   毎 PR で preview が立つので、確認場所はそこで足りる。
   `?study=off` で従来のサイドバー版に戻れること、`?study=auto` で配信どおりに戻ることも確認する。

   > **Vercel preview に `NEXT_PUBLIC_STUDY_HOME` を置かないこと。** 環境変数の
   > Preview scope は**全ブランチの preview に効く**ため、このブランチのために置いて
   > 忘れると、以後すべての PR の preview が書斎になる。しかも上のとおり不要。
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

`NEXT_PUBLIC_STUDY_HOME=off` を入れて再デプロイするだけで元に戻る。**既定 on にしたので、
PostHog フラグを切っても止まらない**（書斎は PostHog を見ていない）。

ただし **`?study=on` を触った端末は憶えたまま**なので、配信の停止だけでは戻らない。
その端末は `?study=auto` を開いて切替を捨てる。
