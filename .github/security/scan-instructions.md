# Oryzae セキュリティ監査の観点

Oryzae はジャーナリング（日記）アプリです。**扱うデータは、ユーザーが誰にも見せない前提で
書いた極めてプライベートな文章**です。したがって重大度の判断基準は一貫して次の一点です:

> **ある人の日記本文（およびそこから派生した分析結果・キーワード・手紙）が、
> 本人以外の目に触れる経路があるか。**

汎用的な脆弱性カテゴリ（SQLi / XSS など）よりも、**データ越境**を優先して探してください。
以下はこのコードベース固有の前提と、重点的に見るべき経路です。

---

## 1. 認可モデル（これを誤解すると誤検知の山になる）

このリポジトリには **2 種類の Supabase クライアント**があり、認可の効き方が正反対です。

### (a) ユーザー向け API — RLS が認可境界

`apps/server/src/contexts/shared/presentation/middleware/auth.ts` の `authMiddleware` は
**anon key + ユーザーの JWT** でクライアントを生成し、`c.set('supabase', ...)` で流します。
このクライアント経由のクエリには **RLS が適用されます**。

つまり repository が `.eq('user_id', ...)` を書いていなくても、それ自体は脆弱性ではありません。
例: `SupabaseEntryRepository.findById(id)` にユーザー絞り込みが無いのは RLS 前提の設計です。
**これを IDOR として報告しないでください。**（`false-positives.md` も参照）

このモデルが崩れるのは次の場合です。ここを探してください:

- 新しいテーブルに RLS が設定されていない（`pnpm security:rls` が検出しますが、
  マイグレーションを経ずに作られたテーブルは検出できません）
- RLS ポリシーが `USING (true)` などで実質無効化されている
- `authMiddleware` を通らないルートが追加された（`app.ts` のルーティング登録を確認）
- middleware が JWT 検証をせずに `userId` をリクエストボディ/クエリから取っている

### (b) service role クライアント — RLS を完全にバイパス

`apps/server/src/contexts/shared/infrastructure/supabase-client.ts` の `getSupabaseClient()` は
`SUPABASE_SERVICE_ROLE_KEY` を使い、**RLS を無視して全ユーザーのデータにアクセスできます**。

利用箇所は `apps/server/.dependency-cruiser.cjs` の `service-role-client-containment` ルールで
許可リストに固定されています（auth / signup / admin / cron）。

**最優先で見るべきは、この service role 経路にユーザー入力の ID が流れ込んでいないか**です:

- リクエストパラメータの `userId` / `entryId` を、そのまま service role クライアントの
  クエリ条件に使っていないか（= 任意ユーザーのデータを読める）
- `auth.admin.*` 系の呼び出しに、ユーザーが制御できる値が渡っていないか

---

## 2. 最悪シナリオ: fermentation のメール送信経路

`apps/server/src/contexts/fermentation/` は次の処理を行います:

1. cron（`cron-fermentation.ts`）が **service role** で対象ユーザーを列挙する
2. ユーザーの日記本文を Claude API に送る（`llm/vercel-ai-analysis.gateway.ts`）
3. 生成された「手紙」「キーワード」「切片（日記からの逐語引用）」を保存する
4. **その内容をユーザーにメール送信する**

ここには **A さんの日記の分析結果が B さんにメールで届く**という、このプロダクトで
最も深刻な事故の可能性があります。次を厳密に追跡してください:

- ユーザー ID → メールアドレスの解決（`SupabaseVerifiedEmailResolver` 等）で、
  **ループ変数の取り違え・非同期処理の競合・キャッシュの共有**が起きていないか
- 複数ユーザーを並行処理する箇所で、ユーザー単位の状態がモジュールスコープや
  シングルトンに保持されていないか（リクエスト間で漏れる）
- 分析結果の保存時、`user_id` が「分析対象のユーザー」と一致しているか
  （リストのインデックスずれで別ユーザーに紐づく事故）
- メール本文に日記の逐語引用（`snippets[].text`）が含まれる点を踏まえ、
  宛先解決の失敗時に「とりあえず送る」フォールバックが無いか

---

## 3. 日記本文の外部流出（ログ・監視・LLM）

`docs/observability-guide.md` のとおり Sentry / PostHog / AI Gateway / Vercel を使っています。
**日記本文がこれらに載ると、第三者 SaaS に平文で蓄積されます。**

- `console.log` / `logger.*` / `Sentry.captureException` の引数に、entry の `content`、
  snapshot の内容、snippet の `text`、letter の本文が含まれていないか
- 例外オブジェクトに日記本文が入った状態で throw され、Sentry に自動送信されていないか
  （エラーメッセージへの本文埋め込みが典型）
- PostHog のイベントプロパティに本文や、本文から復元可能な情報が入っていないか
- LLM 呼び出しのプロンプト/レスポンスをデバッグ目的でログ出力していないか
- クライアント側（`apps/client`）で、日記本文が URL クエリ・localStorage・
  外部スクリプトから読める DOM 属性に置かれていないか

## 4. プロンプトインジェクション

日記本文はそのまま LLM に渡ります。ユーザーが自分の日記に指示文を書けば、
LLM の出力を操作できます。被害範囲は原則その本人に閉じますが、次は要確認です:

- LLM の出力が **他ユーザーに見える場所**（管理画面の一覧、共有機能など）に出ないか
- LLM 出力がメール HTML にエスケープなしで埋め込まれていないか（メール経由の XSS/フィッシング）
- LLM 出力が後続の処理で**コード・SQL・シェルとして解釈される**経路が無いか

## 5. 管理画面（apps/admin）

管理画面は運営が全ユーザーを横断して見る前提です。だからこそ:

- `admin-auth.ts` の認可が、単なる「ログイン済み」ではなく**管理者判定**になっているか
- 管理者判定の根拠がクライアントから改変可能な値（ヘッダ・cookie の平文値）でないか
- admin の画面・API に、業務上不要な**日記本文そのもの**が出ていないか
  （統計・件数で足りる場面で本文を返していないか）

## 6. 認証・セッション

- サインアップ/ログイン（`shared/presentation/routes/auth.ts`、`user/presentation/routes/signup.ts`）は
  service role を使うため、ここのロジック不備は直接アカウント乗っ取りに繋がる
- nickname でログイン解決する設計のため、**nickname の列挙・総当たり**に対する
  レート制限（`shared/presentation/middleware/rate-limit.ts`）が効いているか
- パスワードリセット/メール変更のトークンに、推測可能性・有効期限・再利用防止の不備が無いか
- JWT / アクセストークンがクライアントで安全に保持されているか

## 7. ストレージ

- `board-photos` / `avatars` バケットのポリシー（`supabase/migrations/`）
- 非公開であるべきバケットが `public = true` になっていないか
- 署名付き URL の有効期限が過大でないか、URL がログに出ていないか

---

## 報告の書き方

各指摘には必ず次を含めてください:

1. **file:line**
2. **攻撃者が具体的に何をするか**（リクエスト例・手順）
3. **その結果どのデータが誰に漏れるか**
4. **修正方針**

「〜の可能性がある」「〜を検討すべき」といった、実際の悪用手順を示せない指摘は
出さないでください。誤検知はレビュー体力を消耗させ、最終的にアラート全体が
無視されるようになり、本物の脆弱性を見逃す原因になります。
