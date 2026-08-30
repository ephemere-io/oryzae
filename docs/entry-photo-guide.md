# エントリ写真ガイド（アップロード + 文字起こし）

エントリ作成画面の「写真」機能の設計判断の正。実装前にここを読むこと。

---

## 何ができるか

エントリ作成画面（PC / SP 両方）の写真ボタンから画像を選ぶと、2つの取り込み方を選べる。

| 取り込み方 | 挙動 | 保存先 |
| --- | --- | --- |
| 文字として読み込む | 画像から文字を起こし、確認のうえ本文カーソル位置に挿入する | `entries.content` |
| 写真として貼る | 画像をそのままエントリに添える | `entries.media_urls`（ストレージパス） |

どちらも同じ 1 枚の画像に対して行えるし、両方やってもよい（文字を起こしたうえで元の写真も残す）。

---

## なぜ従来型 OCR ではなく VLM（Claude）なのか

「写真を文字にする」は Tesseract.js や Google Cloud Vision でも実現できる。それでも
VLM を選んだ理由は次の 3 つ。

1. **手書きに強い必要がある。** Oryzae で撮る対象は手帳・ノート・本の書き込みで、手書き率が
   高い。Tesseract.js の日本語手書き精度は実用水準に届かない。
2. **整形まで必要。** 読み取り結果はそのまま日記本文に流し込む。従来型 OCR が返すのは紙幅で
   折り返された改行だらけのテキスト塊で、結局これを整えるために LLM を呼ぶことになる。VLM なら
   読み取りと整形が 1 往復で終わる。
3. **すでに口がある。** `@ai-sdk/anthropic` は fermentation で導入済み。外部サービスも
   認証情報も増やさずに済む。

縦書きにも対応できるのも大きい（`jpn_vert` のような別データを持たなくてよい）。

### モデル選定

`claude-sonnet-5`（`anthropic-photo-transcription.gateway.ts` の `OCR_MODEL`）。

| モデル | input / output ($/1M) | 1枚あたり概算 |
| --- | --- | --- |
| `claude-haiku-4-5` | $1 / $5 | 約 $0.007 |
| `claude-sonnet-5` | $3 / $15 | 約 $0.02 |
| `claude-opus-5` | $5 / $25 | 約 $0.035 |

長辺 1568px にリサイズした写真で入力 1,500〜2,500 tokens、出力 1,000 tokens 程度を想定した
概算。文字起こしは定型タスクなので Opus の推論力は要らない一方、手書きがあるため Haiku まで
落とすと精度が目に見えて落ちる。中間の Sonnet を既定とする。

変更するときは `OCR_MODEL` を差し替える。

### コスト: 総額は Anthropic、内訳は自前

**この 2 つは別の道具**なので、両方持つ。

**総額（いくら請求されるか）** は Anthropic の Cost Report（`anthropic-cost-report.ts`、
`GET /v1/organizations/cost_report`）から**実請求額**を引く。キャッシュ割引・
コンテキスト窓別単価・tier 割引・期間限定価格まで込みの数字が返るので、自前の価格表では
到達できない正確さになる。Admin API キー（`sk-ant-admin...`、Console > Settings >
Admin keys）を `ANTHROPIC_ADMIN_KEY` に置き、`x-api-key` で送る。通常の
`ANTHROPIC_API_KEY` とは別物。

**内訳（誰が・どの機能が、いくら使っているか）** は自前で持つしかない。Anthropic 側が
知っているのは API キーとワークスペースであって、こちらの `user_id` ではないため。
1 回の文字起こしにつき `photo_transcription_usages` に 1 行入れる（`00024`）。
立ち上げ期に効くのはこちらで、「ユーザーが 1 人増えると月いくら増えるか」は
総額（Anthropic）÷ 分母（自前）でしか出せない。

Admin キーが無い環境では `claude-pricing.ts` の価格表からの概算に落ち、レスポンスの
`estimated: true` と `pricingAsOf` を返す。管理画面はそれを見て "(est.)" と単価の時点を
出す —— 概算を請求額と取り違えないようにするため。

**起こした文字そのものは保存しない。** 日記の中身であり、本文に入れた時点で `entries` に
残るため、重複して置く理由が無い。記録するのはモデル名・トークン数・文字数だけ。

### 支出上限に達したとき

Anthropic 側で止まる経路は 3 つ（残高切れ 402 / ティア上限 429 +
`enforced_spend_limit_reached` / 自分で設定した上限 400）。これを「AI が失敗した」と
まとめて扱うと、ユーザーには原因不明の不具合に見える。`anthropic-spend-limit.ts` が
待てば直るレート制限と区別し、`SpendLimitReachedError`（503）に変換して、
クライアントは専用の文言（`photo.error_spend_limit`）を出す。

**請求額そのものを抑えたいなら、Console > Settings > Billing で支出上限を設定するのが
確実。** オートリロードを切れば、買ったクレジット以上は請求されない。

---

## 画像の扱い

- **クライアントでリサイズしてから送る**（`lib/resize-image.ts`）。長辺 1568px、JPEG。
  スマホの写真は 4000px 級で、そのまま送ると画像トークンが桁で増えるうえアップロードも遅い。
  canvas を通すので HEIC など Anthropic が受け付けない形式も JPEG に正規化される。
- **受け付ける形式**は `ACCEPTED_IMAGE_MIME_TYPES`（`@oryzae/shared`）。Anthropic が
  受理するのは jpeg / png / gif / webp のみなので、それに合わせている。
- **上限サイズ**は `MAX_ENTRY_PHOTO_BYTES`。リサイズ後の想定を大きく超えるものは弾く。

## 保存先

Supabase Storage の `entry-photos` バケット（`00023_create_entry_photos.sql`）。
パスの先頭セグメントを `user_id` にすることで、upload / read / delete の 3 ポリシー
すべてが `auth.uid()` で自分のフォルダに絞れる。専用テーブルは作らない。

**バケットは private。公開 URL は使わない。** board-photos は当初 public バケット +
read ポリシーにユーザー隔離なし で作られており、#504 で「他ユーザーの写真を列挙・取得
できる」状態だったことが判明して塞がれた（`00021_secure_board_photos.sql`）。日記の写真は
board よりさらに機微なので、最初から private + 隔離で作っている。**00006 の初期設定を
コピーしないこと。**

表示用の URL はサーバ側で `createSignedUrl` して都度発行する（有効期限 1 時間）。
署名 URL は失効するので、`entries.media_urls` に保存するのは **URL ではなくストレージパス**。
エントリ取得時に `GetEntryUsecase` がパスを署名し、`mediaSignedUrls` として別に返す
（`media_urls` はパスのまま返るので、クライアントはそれをそのまま保存に送り返せる）。

## レート制限

`POST /api/v1/entries/photos/transcribe` は 1 リクエストが実費なので、全体の
`rateLimitGeneral()`（60/min）とは別に `ocr` ティア（10/min）を重ねている。

## プライバシー

写真は文字起こしのため Anthropic の API に送られる。対応済み:

- プライバシーポリシー（`apps/client/src/content/legal/privacy.{ja,en}.md`）の §3.2・§5-2・§6 に記載。
- UI 上でも、取り込みモーダル／シートで操作前に `photo.ai_notice` を表示している。

「写真として貼る」だけを選んだ場合は AI に送信されない（Storage に上げるだけ）。この区別は
ポリシー本文にも明記してあるので、フローを変えるときは合わせて直すこと。

---

## いまやっていないこと（既知の宿題）

- **本文の途中に写真を差し込む表示**。いまは本文の下にまとめて並べる。本文の途中に食い込ませる
  には `content` にプレースホルダを埋め、PC の contentEditable の直列化を `innerText` から
  専用シリアライザに差し替える必要がある（`editor-effects-codec.ts` の DOM walk に相乗りする
  形になる）。SP は textarea なので画像を描けず、編集中はチップ表示・閲覧時に画像化という
  二段構えが要る。
- **管理画面での機能別コスト内訳**。月次合計は発酵と文字起こしを足した概算で出しているが、
  分けて見る画面はまだ無い（データは別テーブルなので分離自体はすぐできる）。
- **Storage の孤児ファイル回収**。写真ストリップから削除すると `media_urls` からは外れるが、
  Storage 上のオブジェクトは残る（gateway の `delete()` は実装済みで、呼ぶ導線が無い）。
