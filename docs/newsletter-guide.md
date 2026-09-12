# ニュースレター（一斉配信）ガイド

登録使用者へお知らせメールを一斉配信する仕組み（Issue #614）。管理画面の
`/newsletters` から下書きを書き、送信前に HTML プレビューと宛先数を確認して送る。

---

## いちばん大事な前提

**これは「日記の通知」ではなく「読みたくない人にも届くメール」である。**

発酵 digest は本人が書いたものへの応答なので、届くこと自体が期待されている。
一斉配信はそうではない。だから設計上の重心が違う:

| | 発酵 digest | ニュースレター |
| --- | --- | --- |
| 宛先 | 発酵したユーザー 1 名 | 全登録者 |
| 送信のきっかけ | cron / 条件成立 | 人が押す |
| やり直し | 次の発酵で自然に届く | **取り消せない** |
| 止める口 | 発酵を止める | `profiles.newsletter_opt_out` |

「取り消せない」がすべての制約の理由になっている。

---

## 送信までの流れ

```
[admin] 下書きを書く（または PR から生成）
   ↓ 保存（status = draft）
[admin] 「送信する…」→ GET /:id/preview
   ↓ 実際に届く HTML + その時点の宛先数
[admin] 「送信する」→「本当に N 名へ送る」（2 段階）
   ↓ POST /:id/send { confirm: true }
[server] 宛先を数える → status = sending で保存 → Resend batch → status = sent
```

### 二重送信をどう塞いでいるか

数百通の送信は秒単位かかるので、その間に 2 回目の要求が来ると全員に 2 通届く。
**宛先を数えた直後に `status = sending` を保存**し、以後の要求はドメインの
状態遷移（`withSendingStarted`）で弾く。押し間違い由来の二度押しはこれで止まる。

送信が途中で落ちたら `draft` に戻して `last_error` を残す。`sending` のまま
固まると、その配信は以後永久に送れなくなるため。

### 確認は UI ではなく API の契約

`POST /:id/send` は本文に `{ confirm: true }` を要求する。画面の 2 段階クリック
だけに頼ると、URL を直接叩いた / 画面を差し替えたときに黙って全員へ送れてしまう。

---

## 宛先（audience）

`SupabaseNewsletterAudience` が返すのは次を**すべて**満たす人:

- Supabase Auth に email がある
- `email_confirmed_at` が入っている（未確認は本人のアドレスである保証が無い）
- `profiles.newsletter_opt_out = false`

宛先数は**確認画面を開くたびに数え直す**。保存済みの値を使うと、下書きを書いて
から送るまでに増減したぶんがずれる。ずれた数字を確認画面に出すくらいなら、
同じ経路で数える（`countRecipients` が `listRecipients().length` なのはそのため）。

### 配信停止

`profiles.newsletter_opt_out` を立てる。UI はまだ無く、メール本文フッターの
連絡先（`oryzae@ephemere.io`）に来た申し出を運営が手で反映する運用。

Auth の `user_metadata` ではなく `profiles` に置いたのは、`user_metadata` が
ユーザー自身の触れる場所と同じで「止めたはずが戻っている」事故を作りうるため。

### アドレスを漏らさない

宛先は**1 通 1 アドレス**で送る（Resend の batch endpoint に 1 件ずつ積む）。
BCC でまとめると受信者同士にアドレスが見える。誰が Oryzae を使っているかは、
日記そのものではないが十分に機微。

送信結果も**宛先を返さない**。失敗は理由ごとの件数だけに束ねる
（`failureReasons: [{ reason, count }]`）。送信ログに個人を並べない。

---

## 本文の記法

`newsletter-content.service.ts` が Markdown の**サブセット**だけを解釈する:

```
# / ## / ###      見出し
-                 箇条書き
---               区切り線
**太字**
[テキスト](URL)   リンク（http/https のみ）
空行              段落の区切り
```

### なぜ Markdown ライブラリを入れないか

メール HTML は「ブラウザの HTML」ではない。Gmail は `<style>` を落とし、
Outlook は CSS の大半を解釈しない。素の変換器が吐く `<h1>` / `<ul>` は
インラインスタイルが無いぶんクライアントごとに別物に見える。どのみち出力側を
全部書き直すことになるので、入力側も運営が書く範囲に絞った自前の変換にしてある。

### エスケープの順序

**先に HTML をエスケープしてからインライン記法を適用する。** 逆にすると本文に
書かれた `<script>` がそのまま HTML に落ちる。リンク先は `http` / `https` のみ
通し、`javascript:` や `data:` をメール本文から作れないようにしている。

HTML とテキストの両方を必ず送る。HTML だけのメールはスパム判定の材料にもなる。

---

## PR から下書きを生成する

`POST /newsletters/generate-draft`:

1. 直近に送信し終えた配信の `sent_at` を起点にする（初回は直近 30 日）
2. GitHub の **merged PR** をその起点以降で読む（`GITHUB_TOKEN` が要る）
3. LLM に「利用者から見て何が変わったか」へ翻訳させる
4. **必ず下書きとして保存する**

### なぜコミットでなく PR か

コミットは粒度が細かすぎて（`fix: typo` が並ぶ）リリースノートの素材にならない。
このリポジトリは main への直接 push を禁じていて変更は必ず PR を通るので、
PR のタイトルと本文が一番良い粒度になる。

### PR が 0 件なら作らない

素材ゼロで LLM に書かせると、それらしい嘘のリリースノートが出てくる。
何も変わっていないなら作らずにそう言う（`NewsletterNoChangesError`）。

### モデル

`NEWSLETTER_MODEL_ID`（`claude-pricing.ts`）。**発酵 / OCR / 写真の文字起こしと
別モデルであることが要件**で、`claude-pricing.test.ts` が固定している。
Anthropic は用途を知らないので、費用の用途別内訳はモデル ID でしか引けない。
同じモデルを共有すると、月 1 回の下書き生成の費用が発酵の費用に混ざって
二度と分けられなくなる。

---

## 実装の地図

### サーバー（`apps/server/src/contexts/newsletter`）

```
domain/
  models/newsletter.ts                     状態遷移（draft → sending → sent）と検証
  services/newsletter-content.service.ts   Markdown サブセット → HTML / テキスト
  gateways/                                repository / audience / bulk-email / changelog / draft-generator
application/usecases/
  create / update / delete / get / list
  preview-newsletter.usecase.ts            HTML + テキスト + 宛先数
  send-newsletter.usecase.ts               状態遷移つきの送信
  generate-newsletter-draft.usecase.ts     PR → LLM → 下書き
infrastructure/
  repositories/supabase-newsletter.repository.ts
  audience/supabase-newsletter-audience.ts
  email/resend-bulk-email-sender.ts        Resend batch（100 通/リクエスト）
  github/github-changelog-source.ts
  llm/vercel-ai-newsletter-draft.gateway.ts
presentation/routes/admin-newsletters.ts   /api/v1/admin/newsletters
```

### 管理画面（`apps/admin/src/features/newsletters`）

`hooks/use-newsletters`（一覧）・`use-newsletter-mutations`（保存・削除・生成）・
`use-newsletter-send`（プレビューと送信）。**送信だけフックを分けてある** ——
取り消せない操作を保存と同じ loading / error の枠で扱うと押し間違いが起きる。

プレビューは `<iframe srcDoc sandbox="">` に閉じ込める。メールの HTML は admin
画面と無関係の CSS を持つので直接差し込むと画面が壊れるし、sandbox なら万一
script が混ざっても動かない。

### DB（`supabase/migrations/00024_create_newsletters.sql`）

`newsletters` は運営者が書く文章でユーザー単位の行という概念が無いため、RLS は
**service_role だけ**に閉じる（admin API は `adminAuthMiddleware` が `is_admin` を
検証したうえで service role クライアントを渡す）。`profiles.newsletter_opt_out`
を同じ migration で追加している。

---

## 環境変数

| 変数 | 無いとどうなるか |
| --- | --- |
| `RESEND_API_KEY` | 送信が `{ sent: false, reason: 'no-api-key' }` で止まる（`sent` にはならない） |
| `EMAIL_FROM` | 既定の `noreply@mail.oryzae.ephemere.io` を使う |
| `EMAIL_ENABLED=false` | 送信が `reason: 'disabled'` で止まる（dev 用） |
| `GITHUB_TOKEN` | 下書き生成だけが 400 になる。配信そのものは動く |
| `GITHUB_REPO` | 既定 `ephemere-io/oryzae` |

`EMAIL_ENABLED=false` や API キー未設定で止まった配信は `draft` のまま残る。
**`sent` にしない**のは、設定を直したあとにもう一度送れるようにするため。
