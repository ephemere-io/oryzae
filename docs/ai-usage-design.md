# AI の利用記録（ai_usage）

ユーザーが AI の機能を 1 回使うごとに、`ai_usage` に 1 行残す。
「誰が・いつ・どの機能を・何に対して・何トークン使ったか」の置き場はここ 1 か所。

2026-09-26 起案。日次コストレポートに「誰が使ったか」を全機能ぶん出す作業の中で、
利用量の置き場が機能ごとにばらばらだったのを 1 つにまとめた。

---

## なぜ作ったか

| 機能 | これまでの記録 |
|---|---|
| 発酵 | 発酵の記録（`fermentation_results`）の端にトークン数を書いていた |
| ボード OCR | どこにも無い |
| 写真の文字起こし | どこにも無い |

- 使った量を知りたいとき、見る場所が機能ごとに違う（OCR は見る場所すら無い）
- 発酵の記録に、発酵とは関係ない「使った量」が混ざっている
- 発酵を再試行すると同じ行を上書きするので、前の試行で使った分が消える

## 形

```sql
create table public.ai_usage (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  feature       text not null check (feature in ('fermentation', 'ocr_board', 'ocr_entry')),
  ref_id        uuid,
  input_tokens  integer not null,
  output_tokens integer not null,
  created_at    timestamptz not null default now()
);
```

| 列 | 中身 |
|---|---|
| `user_id` | 誰が |
| `feature` | どの機能か。API キーの分け方と同じ（`fermentation` / `ocr_board` / `ocr_entry`） |
| `ref_id` | 何に対してか。発酵なら `fermentation_results` の id。OCR は保存物が無いので null |
| `input_tokens` / `output_tokens` | Anthropic が返したトークン数（推定ではない） |
| `created_at` | いつ |

たとえば:

| いつ | 誰が | 機能 | 何に対して | 入力 | 出力 |
|---|---|---|---|---|---|
| 9/25 3:05 | kunimo | 発酵 | 発酵 #a1b2 | 3,105 | 3,898 |
| 9/25 14:10 | あきら | ボード OCR | — | 1,200 | 80 |
| 9/25 20:30 | ばば | 写真の文字起こし | — | 1,800 | 40 |

## 決めたこと

- **名前は `ai_usage`。** 「AI を呼んだ」（仕組みの側）ではなく「ユーザーが AI をどれだけ使ったか」
  （使う人の側）で名付けた。Oryzae で使うたびに費用が増えるものは AI だけなので、対象は AI と明記する
- **同じ種類の情報は 1 か所。** 発酵のトークン数もここに寄せ、`fermentation_results` からは消す
  （段階 2）。発酵の記録は発酵のことだけを書く
- **既存の形に揃える。** `id` / `user_id` / `created_at` は他の表と同じ。
  「種類 + 指す先の id」は `board_cards` の `card_type` + `ref_id` と同じ形で、外部キーは張らない
- **今使う列だけ。** モデル名・成否・キャッシュのトークン・所要時間・request id は持たない。
  要るようになったら列を足す
- **AI が応答したときだけ書く。** 失敗して応答が無ければトークン数が分からないので書かない。
  応答のあとで保存が落ちても、課金は済んでいるので記録は残す
- **金額は持たない。** 実請求額は Anthropic の cost_report（Workspace 別）が正。
  ユーザー別の推定は、読むときにトークン × 単価で出す
- **日記の中身は持たない。** 本文・読み取った文字・画像・プロンプトはどれも入れない

## 書く・読む

| | 誰が | どうやって |
|---|---|---|
| 書く（OCR） | ユーザー本人のリクエスト | ユーザーの JWT。RLS の insert ポリシーが `auth.uid() = user_id` |
| 書く（発酵） | cron・管理画面・ユーザー本人 | 発酵の repository と同じクライアント |
| 読む | 日次レポート・管理画面 | service role |

この記録のために service role の利用箇所は増やしていない。ユーザー本人の読み取りは今は許さない
（「今月の使用量」を本人に見せるときに select ポリシーを足す）。

書き込みは `recordAiUsage`（`shared/application/record-ai-usage.ts`）を通す。
記録に失敗しても本来の処理は失敗させない。Vercel が応答後に関数を止めるので、必ず await する。

## 移行

1. `ai_usage` を作り、`fermentation_results` にトークン数が残っている発酵を移す
   （`supabase/migrations/00027_create_ai_usage.sql`）。時刻は発酵の `created_at` に揃える
2. 発酵・ボード OCR・写真の文字起こしがすべて `ai_usage` に書く。
   日次レポートと管理画面は `ai_usage` から読む
3. **本番で数日動くのを確かめてから**、`fermentation_results` の `input_tokens` / `output_tokens` /
   `generation_id` を消す（別の PR）。移行の途中で古いコードが古い列に書くことがあるので、
   1 と同時には消さない。`generation_id` は AI Gateway 時代の旧データを管理画面で引くためにまだ読んでいる

## 機能を足すとき

`feature` の check 制約に 1 語足す migration と、`AiFeature`（`ai-usage-recorder.gateway.ts`）に
1 語足すだけ。表は増やさない。
