# セキュリティガイド

Oryzae の脅威モデルと、それを守るための自動監視の構成。「何をなぜ守るか」を記述する。
具体的な設定値はコードと `.github/workflows/security.yml` が正。

---

## 脅威モデル

Oryzae が預かるのは、ユーザーが誰にも見せない前提で書いた日記本文である。
したがって重大度の判断基準はただ一つ:

> **ある人の日記本文（およびそこから派生した分析結果・キーワード・手紙）が、
> 本人以外の目に触れる経路があるか。**

汎用的な脆弱性カテゴリよりも、**データ越境**を優先する。

| リスク | 具体例 | 守り方 |
|---|---|---|
| 他ユーザーへの越境 | RLS 漏れ、service role の誤用 | RLS ゲート + dep-cruise |
| 誤った宛先への送信 | fermentation の手紙が別人に届く | 監査観点（後述）・テスト |
| 第三者 SaaS への流出 | 本文が Sentry / PostHog に載る | 監査観点・レビュー |
| 秘密情報の漏洩 | service role key の push | GitHub secret scanning + push protection |
| 未認証の第三者 | public バケット、署名なし URL | RLS ゲート |

## 認可モデル

**このリポジトリには認可の効き方が正反対な 2 種類の Supabase クライアントがある。**
ここを取り違えると、安全なコードを脆弱だと誤認したり、その逆をやったりする。

### (a) ユーザー向け API — RLS が認可境界

`apps/server/src/contexts/shared/presentation/middleware/auth.ts` の `authMiddleware` が
**anon key + ユーザーの JWT** でクライアントを生成し `c.set('supabase', ...)` で流す。
このクライアント経由のクエリには RLS が適用される。

結果として `SupabaseEntryRepository.findById(id)` のように `user_id` で絞っていない
repository があるが、**これは設計どおり**で IDOR ではない。認可は RLS が担う。

**裏を返すと、RLS はこのプロダクトの単一障害点**である。新しいテーブルに RLS を
付け忘れた瞬間、他人の日記が読める。だから AI レビューの確率的な検出ではなく、
決定的なゲート（`pnpm security:rls`）で守る。

### (b) service role — RLS を完全にバイパス

`shared/infrastructure/supabase-client.ts` の `getSupabaseClient()` は
`SUPABASE_SERVICE_ROLE_KEY` を使い、RLS を無視して全ユーザーのデータにアクセスできる。

ログイン前の認証処理・管理画面・cron など、ユーザー JWT が存在しない文脈でのみ必要。
利用箇所は `apps/server/.dependency-cruiser.cjs` の `service-role-client-containment`
ルールで許可リストに固定し、CI で強制する。

**危険なのは「使っていること」ではなく「ユーザーが制御できる ID をそのまま
クエリ条件に渡すこと」**。それは RLS バイパス下では任意ユーザーのデータ取得になる。

## 最も深刻な事故シナリオ: fermentation のメール送信

`apps/server/src/contexts/fermentation/` は、cron が **service role** で全ユーザーを列挙し、
各ユーザーの日記本文を Claude API に送り、生成された手紙・キーワード・日記からの
逐語引用をメール送信する。

ここでユーザーの取り違え（ループ変数のずれ、非同期の競合、モジュールスコープに
持ったユーザー状態、宛先解決の失敗時フォールバック）が起きると、
**A さんの日記の中身が B さんにメールで届く**。復旧不能な事故なので、
この経路の変更は特に慎重にレビューする。

---

## 自動監視の構成

3 層。**上に行くほど確実で安価、下に行くほど広範囲だが確率的。**

### 層 1 — 決定的ゲート（毎 PR・API キー不要・無料）

`.github/workflows/security.yml` の `rls-gate` / `codeql` / `dependency-audit`。
AI と違って見落とさない。ここが本丸。

| ゲート | 実体 | 守る不変条件 |
|---|---|---|
| `pnpm security:rls` | `scripts/check-rls-policies.mjs` | 全テーブルに RLS / ポリシー必須 / `USING (true)` に `TO` 必須 / **読み取りポリシーに `auth.uid()` 必須** / public バケット禁止 |
| `pnpm dep-cruise` | `service-role-client-containment` | service role の利用箇所を許可リストに固定 |
| Semgrep (OSS) | `p/security-audit` `p/secrets` `p/typescript` `p/react` | JS/TS の汎用脆弱性 |
| gitleaks (OSS) | `.gitleaks.toml` | git 履歴を含む秘密情報の混入検出 |
| `pnpm audit` | pnpm | 依存の既知 CVE（high 以上） |

読み取りを許すポリシー（`FOR SELECT` / `FOR ALL`）は、条件式に `auth.uid()` が
現れることを必須にしている。`USING (true)` だけを禁止しても、
`using (is_published = true)` のような「一見絞っているが全ユーザー分が読める」
ポリシーが素通りするため。所有者を辿るサブクエリ（`entry_id in (select id from
entries where user_id = auth.uid())`）は条件を満たす。全ユーザー共通の参照データなど
本当に隔離不要な場合は `-- @rls-exempt: <理由>` で明示する。

**RLS ゲートは全マイグレーションを順に再生した最終状態で判定する。**
`DROP POLICY` / `DROP TABLE` / バケットの public 更新を追跡するので、後続マイグレーションで
直せば自然に緑に戻る。既存の未修正リスクは `supabase/rls-baseline.json` に登録して
CI を止めない（`verify-coverage-gate` と同じ段階導入の思想）。直したのに baseline に
残っているとゲートが落ちる（baseline の腐敗防止）。

### 層 2 — PR 差分の意味的レビュー（毎 PR・AI・補助）

`anthropics/claude-code-security-review` が差分を読み、PR にインラインコメントする。
観点は `.github/security/scan-instructions.md`、誤検知の抑制は
`.github/security/false-positives.md` で制御する。

**この 2 ファイルがこの層の価値のほぼ全て。** 汎用スキャナは「SQL injection」は見るが
「この文字列は日記本文だから外に出してはいけない」は教えないと分からない。
誤検知が続くとアラート全体が無視されるようになるため、誤検知フィルタの整備は
検出観点の追加と同じくらい重要。

### 層 3 — 週次のリポジトリ全体監査（→ Issue 起票）

差分レビューは構造上「既に main にある問題」を永久に見つけられない。
週次で `anthropics/claude-code-action` がリポジトリ全体を監査し、重大な指摘があれば
GitHub Issue に起票（既存 Issue があればコメント追記）する。
**指摘ゼロなら起票しない** — 毎週ノイズを立てると誰も読まなくなるため。

### GitHub 標準機能と、private 化による制約

**このリポジトリは private である。** GitHub のセキュリティ機能は public では無料だが、
private では有料（GitHub Advanced Security / Code Security / Secret Protection）になる。
そのため以下は**使えない**:

| 機能 | private での扱い | 代替 |
|---|---|---|
| CodeQL（code scanning） | 有料 | Semgrep OSS（`sast` ジョブ） |
| Secret scanning | 有料 | gitleaks（`secret-scan` ジョブ） |
| **Push protection** | 有料 | **代替なし**（下記） |

利用できるのは **Dependabot security updates**（private でも無料）のみ。

**失われた防御で最も痛いのは push protection** である。GitHub の push protection は
秘密情報を含む push を **サーバー側で押し戻す**が、gitleaks は CI で「push された後に」
気づくだけで、その時点で既にリモートに履歴が残っている。
`SUPABASE_SERVICE_ROLE_KEY` が push されたら、CI が赤くなるより先に**鍵のローテーションが必要**。

この差を埋めたい場合の選択肢:

1. GitHub Secret Protection を購入する（サーバー側ブロックが戻る）
2. gitleaks を pre-commit フックにも入れる（手元で止まる。ただし `--no-verify` や
   別クローンからの push は素通りするので、あくまで補助）
3. リポジトリを public に戻す（GitHub の無料機能が全て戻る。ただし当然ソースは公開される）

## prompt injection への注意

現在このリポジトリは private なので fork 経由の攻撃面は無いが、
**public に戻した瞬間にその経路が生きる**。
`claude-code-security-review` は公式に「prompt injection に対して硬化されていない」と
明記されている。したがって:

- `pull_request_target` は使わない（fork PR にシークレットを渡さない）
- fork PR では AI ジョブは自動 skip され、決定的ゲートのみが走る
- 合否を担保するのは層 1 であり、AI レビューはあくまで補助

## ローカルでの検証

```bash
pnpm security:rls          # RLS ゲート
pnpm dep-cruise            # service role 封じ込めを含む
/security-review           # Claude Code の差分セキュリティレビュー
```

pre-push フックで `pnpm security:rls` が走る。

---

## 既知の未修正リスク

`supabase/rls-baseline.json` の `status: todo` を参照。
現時点の内容は本ドキュメント末尾ではなく、常に同ファイルを正とする。
