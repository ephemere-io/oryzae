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
[admin] 「翻訳を作成」→ 宛先がいる言語へ翻訳（**必須**）
[admin] 「テスト配信」→ 運営者だけに送って受信確認（**必須**・何度でも可）
[admin] 「送信する」→「本当に N 名へ送る」（2 段階）
   ↓ POST /:id/send { confirm: true }
[server] 宛先を数える → status = sending で保存 → Resend batch → status = sent
```

### 本番の前にテスト配信する

```
[admin] 「テスト配信」→ POST /:id/send-test
   ↓ 運営者（is_admin）だけへ、件名に [テスト配信] を付けて送る
[admin] 受信箱で表示・リンク・到達を確認
   ↓ 問題なければ
[admin] 「送信する」→「本当に N 名へ送る」
```

テスト配信は **status を動かさない**。`sending` にも `sent` にもしないので
何度でもやり直せるし、そのあと普通に本番配信できる。記録するのは `test_sent_at` だけ。

#### テストしていない配信は送れない（ハードゲート）

`test_sent_at` が null のあいだ、`withSendingStarted` は `not-tested` で弾く。
画面でも送信ボタンが無効になる。本番配信は取り消せないので、**実際に届く形を
一度も見ないまま撃てる経路を残さない**。

**本文か件名を書き換えると印は消える**（`withContent`）。テストしたあと書き換えて
送れると、確認したのは別の文面ということになり、ゲートが形だけになる。
中身が変わらない保存（同じ文字列で上書き）では消さない —— 触るたびにテストし直しに
なると、今度はテストが儀式になって読まれなくなる。

送信が途中で落ちて `draft` に戻った場合、印は**残る**。文面は変わっていないので、
確認し直す理由が無い。

理由は `blockedReason`（`already-sent` / `not-tested` / `no-recipients`）として
プレビューが返す。画面側で推測して文言を組み立てると、サーバーが実際に弾く理由と
ずれるため。判定順は `withSendingStarted` と揃えてある。

**宛先はメールアドレスではなく `user_metadata.is_admin` で引く。** 名簿をコードに
焼くと、担当が増えた / アドレスを変えたときに黙って届かなくなる（そして気づくのは
本番配信の後）。`is_admin` は `adminAuthMiddleware` が管理画面の認可に使う値と
同じなので、**管理画面に入れる人＝テストを受け取る人** が定義として一致する。

本文は本番と完全に同一で、**配信停止リンクも本物**（署名済みトークン）を載せる
—— そこを差し替えるとリンクが本当に効くかを確かめられない。押すと運営者自身が
配信停止になるが、そのページの「やっぱり受け取る」で戻せる。

件名にだけ `[テスト配信]` を付けるのは、受信箱で本番と見分けるため。区別が
付かないと「届いた」のがテストなのか本番なのか分からず、本番を二度撃つ。

`listTestRecipients()` を `listRecipients()` と**別メソッド**にしてあるのは、
同じメソッドに引数で分岐を足すと引数 1 つの間違いで全員に飛ぶため。型で分けて
おけば取り違えようがない。

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

止める口は **3 つ**あり、どれも同じ `profiles.newsletter_opt_out` 1 列を見る。

| 経路 | ログイン | 仕組み |
| --- | --- | --- |
| メール本文のリンク | 不要 | `/unsubscribe?token=…`（署名付き） |
| 受信箱の「配信停止」ボタン | 不要 | `List-Unsubscribe` ヘッダ（RFC 8058） |
| アカウント設定のトグル | 必要 | `PATCH /api/v1/auth/profile` |

Auth の `user_metadata` ではなく `profiles` に置いたのは、`user_metadata` が
ユーザー自身の触れる場所と同じで「止めたはずが戻っている」事故を作りうるため。

#### なぜログイン不要にするのか

配信停止をするのは「もう読みたくない」人で、その人はログインしない。ログインを
挟むと実質「止められない」に等しくなり、**迷惑メール報告のほうが早くなる**。
報告が積もると送信ドメイン全体の到達率が落ちるので、これは礼儀の話であると同時に
実利の話でもある。Gmail / Yahoo の一括送信者要件（RFC 8058）も認証を挟まない
エンドポイントを前提にしている。

#### 本人性をどう担保するか

`user_id` を HMAC-SHA256 で署名したトークン（`HmacUnsubscribeToken`）。

```
token = base64url(user_id) + "." + base64url(HMAC(secret, "newsletter-unsubscribe:v1:" + user_id))
```

- **`user_id` をリクエストから受け取らない。** 受け取れる形にすると
  「他人の id を入れて止める」が成立する
- **署名対象に用途を混ぜる**（`newsletter-unsubscribe:v1:`）。同じ鍵を将来ほかの
  用途に使ったとき、片方のトークンをもう片方に持ち込めないようにする
- **有効期限を付けない。** 半年前のメールを掘り出して押すことが普通にある。
  期限切れで押せないリンクは、止める口が無いのと同じ。代わりに「押しても失う
  ものが無い」（配信の可否が変わるだけ）ようにしてある
- **まとめて失効させたいときは `NEWSLETTER_UNSUBSCRIBE_SECRET` を替える**
- 「トークンが壊れている」と「その利用者がもういない」は**同じ応答**にする。
  公開エンドポイントなので、応答の差から実在する id を探れる経路を作らない

#### なぜ POST だけなのか

GET で状態が変わる作りだと、メールクライアントやセキュリティスキャナの
**リンク先読み**（Outlook SafeLinks 等）で、本人が押していないのに配信停止になる。

利用者への約束は「クリックするだけで解除」なので、ページ側で確認ボタンを
足すのではなく、**開いた時点で JS が POST する**。先読みは JS を実行しないので
誤作動せず、利用者から見れば 1 回クリックしただけのまま。

押し間違い（と万一の誤作動）から戻れるよう、停止後の画面に「やっぱり受け取る」を
置いてある（同じトークンで `POST /resubscribe`）。

#### service role を使う理由

メールのリンクから来るのでユーザー JWT が存在せず、RLS を認可境界にできない。
`newsletter-subscription.ts` を dep-cruiser の `service-role-client-containment`
許可リストに入れてある。安全性の根拠は「書き込み先の行を決めるのは HMAC 検証済み
トークンから取り出した `user_id` **だけ**」で、リクエスト本文の値をクエリ条件へ
渡す経路が無いこと。更新対象も `profiles.newsletter_opt_out` の 1 列のみ。

#### 送信前に fail-closed

署名鍵が無いと配信停止リンクを作れない。そのとき **送信そのものを 400 で止める**
（`NewsletterUnsubscribeUnavailableError`）。状態は `draft` のまま動かないので、
鍵を設定すればそのまま送れる。止める口の無い一斉メールを送るくらいなら送らない。

### アドレスを漏らさない

宛先は**1 通 1 アドレス**で送る（Resend の batch endpoint に 1 件ずつ積む）。
BCC でまとめると受信者同士にアドレスが見える。誰が Oryzae を使っているかは、
日記そのものではないが十分に機微。

送信結果も**宛先を返さない**。失敗は理由ごとの件数だけに束ねる
（`failureReasons: [{ reason, count }]`）。送信ログに個人を並べない。

---

## 言語ごとに翻訳して配信する

運営者は**日本語だけ書く**。配信時に受信者の言語へ訳したものを送る。

```
[admin] 日本語で書く
[admin] 「翻訳を作成」→ POST /:id/translate
   ↓ 宛先がいる言語ぶんだけ訳して保存（原文が変わっていない言語は訳し直さない）
[admin] プレビューで言語タブを切り替えて確認
[admin] 「テスト配信」→ 用意できている言語版を全部、運営者へ 1 通ずつ
[admin] 「送信する」→ 各自の言語で届く
```

### 誰の言語をどう決めるか

`user_metadata.locale`（`ja` / `en` / `zh` / `ko`）。signup 時にクライアントの
`useLocale()` が保存し、OAuth 経由でも更新される。

**未設定・想定外の値は日本語（原文）に倒す。** 英語に倒す案もあるが、それは
「日本語話者が言語を設定していない」場合に、これまで日本語で届いていた人へ急に
英語を送ることになる。判別できないときは翻訳を挟まない＝運営者が書いたものを
そのまま届けるほうが、外れ方が小さい。

### 翻訳は言語ごとに 1 つ

200 人に送るのに 200 回訳す必要はない。`newsletter_translations` は
`(newsletter_id, locale)` が主キーで、1 配信につき最大 3 行。宛先が増えても
翻訳の費用は増えない。

**宛先が 0 名の言語は訳さない。** 韓国語の登録者が 1 人もいないのに韓国語を
訳すと、誰も読まない文章に払い続けることになる。

### 古い翻訳を配らない

翻訳は「どの原文から訳したか」（`source_subject` / `source_body_markdown`）を
丸ごと持っている。「翻訳済み」フラグだけだと、原文を書き換えたあとも翻訳済みに
見えてしまい、**日本語だけ直った配信が他言語には古い文面で届く**。原文を控えて
おけば、いまの本文と突き合わせるだけで古さが分かる（無効化の書き込みが要らない）。

古い翻訳は「無い」のと同じ扱いで、送信ゲート（`translations-missing`）が止める。

### 原文にフォールバックしない

翻訳が無い / 古い言語の受信者がいたら **送信そのものを止める**。原文を代わりに
送ると「英語のつもりが日本語で届いた」が黙って起きる。

### フッターは訳さない

フッターと配信停止の案内は `newsletter-content.service.ts` が言語ごとの固定文を
持っている（`FOOTER_COPY`）。LLM に毎回訳させると配信ごとに言い回しが揺れるし、
**配信停止の文言が翻訳事故で意味を変えるとそのまま害になる**（「停止する」が
「再開する」になる類）。`<html lang>` も言語に合わせる。

本文だけ訳してフッターを日本語のままにすると、英語話者にとって「止め方が読めない
メール」になる。止める口が読めないのは、止める口が無いのとほぼ同じ。

### テスト配信は全言語ぶん届く

用意できている言語版を**すべて**運営者へ送る（件名は `[テスト配信/en]` の形）。
1 言語ずつ確認していると、訳が崩れている言語に気づかないまま本番を撃つ。

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
書かれた `<script>` がそのまま HTML に落ちる。

リンク先は **`http` / `https` / `mailto`** だけ通す。弾きたいのは `javascript:`
`data:` `vbscript:` `file:` のように、押した先で何かが起きうるもの。受信側の
クライアントがどう扱うかに依存したくない。

`mailto:` は宛先が埋まるだけで何も実行されないので許可する。当初 `http`/`https`
だけにしていたところ、フッターに `[お問い合わせ](mailto:...)` と書いた配信が
**変換されずに記法のまま届いた**。許可していないスキームは黙って素通しになる
（`[文字](URL)` がそのまま出る）ので、プレビューで見れば気づける。

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
  services/newsletter-content.service.ts   Markdown サブセット → HTML / テキスト（言語別フッター）
  services/newsletter-delivery.service.ts  言語ごとにどの文面を送るか / 翻訳の古さ判定
  models/newsletter-locale.ts              配信先の言語と、未設定時の倒し方
  gateways/                                repository / audience / bulk-email / changelog / draft-generator
application/usecases/
  create / update / delete / get / list
  preview-newsletter.usecase.ts            HTML + テキスト + 宛先数
  send-newsletter-test.usecase.ts          運営者だけへのテスト配信（status を動かさない）
  translate-newsletter.usecase.ts          宛先がいる言語へ翻訳（原文が同じなら訳し直さない）
  send-newsletter.usecase.ts               状態遷移つきの送信
  generate-newsletter-draft.usecase.ts     PR → LLM → 下書き
infrastructure/
  repositories/supabase-newsletter.repository.ts
  audience/supabase-newsletter-audience.ts
  email/resend-bulk-email-sender.ts        Resend batch（100 通/リクエスト）+ List-Unsubscribe
  github/github-changelog-source.ts
  llm/vercel-ai-newsletter-draft.gateway.ts
  unsubscribe/hmac-unsubscribe-token.ts    配信停止リンクの署名 / 検証
  llm/vercel-ai-newsletter-translator.gateway.ts
presentation/routes/
  admin-newsletters.ts                     /api/v1/admin/newsletters（要 admin）
  newsletter-subscription.ts               /api/v1/newsletter/{un,re}subscribe（認証不要）
```

### 操作を隠さない

翻訳とテスト配信は **エディタ画面に直接並べる**（`NewsletterDeliveryChecklist`）。

当初はどちらも「送信する…」ダイアログの中に置いていた。ボタンの字面が「送信する」
なので **押すと本当に全員へ送られると読める**。実際、最初に使った運営者はそこで手が
止まり、「テスト配信するにはどう操作するのか」と聞くことになった。

**取り消せない操作の手前に、取り消せる操作を隠してはいけない。** いまは 3 つを
番号付きで並べ、それぞれの状態（翻訳が揃っているか / テスト済みか / 何名に送るか）を
その場に出す。ダイアログは最終確認だけを担う。

順番は見た目だけでなくデータ側でも強制されている:

- 本文か件名を書き換える → 翻訳が古くなる ＋ テストの印が落ちる
- **翻訳を作り直す → テストの印が落ちる**（届くものが変わったので確認し直す）
- テストしていない / 翻訳が欠けている → 送信ボタンが無効

2 番目が無いと、「日本語だけ確認 → 英訳を足す → 送信」が通ってしまい、英語話者に
何が届くのか誰も見ていないまま配信できる。

### 管理画面（`apps/admin/src/features/newsletters`）

`hooks/use-newsletters`（一覧）・`use-newsletter-mutations`（保存・削除・生成）・
`use-newsletter-send`（プレビューと送信）。**送信だけフックを分けてある** ——
取り消せない操作を保存と同じ loading / error の枠で扱うと押し間違いが起きる。

プレビューは `<iframe srcDoc sandbox="">` に閉じ込める。メールの HTML は admin
画面と無関係の CSS を持つので直接差し込むと画面が壊れるし、sandbox なら万一
script が混ざっても動かない。

### 利用者向け（`apps/client`）

| 置き場 | 役割 |
| --- | --- |
| `app/unsubscribe/page.tsx` | 配信停止ページ（**保護ルートの外**） |
| `features/shared/newsletter/` | 停止・再開のフック / 表示部品 / 型 |
| `features/shared/account/components/newsletter-subscription-*.tsx` | 設定画面のトグル |

トグルを `features/shared` に置いたのは、PC と SP で体験が変わらないため
（`pc/` と `sp/` に別々に書くと必ずコピーになる）。表示は「**受け取る**」を ON に
する —— 保存しているのは opt-**out** だが、二重否定のチェックボックスは必ず
読み間違えられる。現在値が読めていない間はトグル自体を出さない（仮の既定値を
触らせると、本人の意図と違う値がそのまま保存される）。

### DB（`supabase/migrations/00024`, `00025`, `00026`）

`newsletters` は運営者が書く文章でユーザー単位の行という概念が無いため、RLS は
**service_role だけ**に閉じる（admin API は `adminAuthMiddleware` が `is_admin` を
検証したうえで service role クライアントを渡す）。`profiles.newsletter_opt_out`
を同じ migration で追加している。

`00025` は `newsletters.test_sent_at` を足すだけ。`sent_at` と別の欄にしてあるのは、
テストは何度でもやり直せる一方で本番配信は 1 回きりだから —— 同じ欄を使うと
「テストしただけなのに配信済みに見える」状態が作れてしまう。

`00026` は `newsletter_translations`（`newsletter_id` + `locale` が主キー）。
日本語は原文そのものなので入らず、`CHECK` で構造的に弾いている。

---

## 環境変数

| 変数 | 無いとどうなるか |
| --- | --- |
| `RESEND_API_KEY` | 送信が `{ sent: false, reason: 'no-api-key' }` で止まる（`sent` にはならない） |
| `EMAIL_FROM` | 既定の `noreply@mail.oryzae.ephemere.io` を使う |
| `EMAIL_ENABLED=false` | 送信が `reason: 'disabled'` で止まる（dev 用） |
| `NEWSLETTER_UNSUBSCRIBE_SECRET` | **送信が 400 で止まる**（配信停止リンクを作れないため） |
| `GITHUB_TOKEN` | 下書き生成だけが 400 になる。配信そのものは動く |
| `GITHUB_REPO` | 既定 `ephemere-io/oryzae` |

`EMAIL_ENABLED=false` や API キー未設定で止まった配信は `draft` のまま残る。
**`sent` にしない**のは、設定を直したあとにもう一度送れるようにするため。
