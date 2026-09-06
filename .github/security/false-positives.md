# 誤検知フィルタ（Oryzae）

以下のパターンは **このコードベースでは脆弱性ではありません**。報告しないでください。

誤検知が続くとレビュアーがアラートを読まなくなり、本物の脆弱性を見逃す原因になります。
判断に迷う場合、ここに書かれた前提に該当しないかを必ず先に確認してください。

---

## 1. repository に `user_id` 絞り込みが無いこと自体

例: `SupabaseEntryRepository.findById(id)` は `.eq('user_id', ...)` を持ちません。

これは設計どおりです。ユーザー向け API のクライアントは `authMiddleware`
（`apps/server/src/contexts/shared/presentation/middleware/auth.ts`）が
**anon key + ユーザー JWT** で生成しており、**RLS が行レベルで絞り込みます**。
repository 側の絞り込みは冗長な二重防御であって、必須ではありません。

**IDOR として報告しないでください。** ただし次は例外で、報告してください:

- そのクエリが `getSupabaseClient()`（service role）由来のクライアントを使っている場合
- 対象テーブルの RLS が無効、またはポリシーが実質全許可の場合

## 2. usecase が `userId` を引数に取らないこと

`GetEntryUsecase.execute(entryId)` のように、認可のための `userId` を受け取らない
usecase があります。認可は RLS が担うため、これも設計どおりです（上と同じ理由）。

## 3. 許可リストに載っている service role の利用

`getSupabaseClient()` の利用箇所は `apps/server/.dependency-cruiser.cjs` の
`service-role-client-containment` ルールで許可リスト化されており、CI で強制されています。
リストに載っているファイル（auth / signup / admin-auth / cron 系 / fermentations）で
service role を使っていること自体は、レビュー済みの意図的な選択です。

**報告すべきなのは「使っていること」ではなく、「ユーザーが制御できる ID を
そのままクエリ条件に渡していること」です。**

## 4. avatars バケットが public であること

`avatars` バケットと `"Anyone can view avatars"` ポリシーは、アバターを公開画像として
配信する意図的な設計です（`supabase/rls-baseline.json` に `status: accepted` で登録済み）。

## 5. `supabase/rls-baseline.json` に登録済みの既知リスク

同ファイルの `status: todo` の項目は**既に把握されており、対応が管理されています**。
定期監査で毎回同じものを再報告しないでください。ただし、baseline の記述より
**影響範囲が広いことを示す新しい証拠**を見つけた場合は報告してください。

## 6. `/verify` ルートの存在

`apps/client` の `/verify` 配下は検証ハーネスのビューで、`VERCEL_ENV=preview` の
プレビュー環境でのみ有効化され、本番では 404 になります。
プレビュー限定であることをコードで確認できる限り、情報漏洩として報告しないでください。

## 7. テストコード・モック内のダミー値

`test/` 配下、`*.test.ts`、`*.verify.tsx`、`.env.example` に含まれる
ダミーのトークン・UUID・メールアドレスはハードコードされた秘密情報ではありません。

## 8. 依存パッケージの既知 CVE

依存の脆弱性は `pnpm audit`（Security ワークフローの `deterministic-gates` ジョブ）と
Dependabot が担当します。AI レビューでは重複して報告しないでください。

---

## 重大度の判断基準

このプロダクトでは **「他人の日記が見えるか」** が唯一の最上位基準です。

- **critical / high** — ある人の日記本文・分析結果・キーワード・手紙が、
  本人以外（他ユーザー / 未認証の第三者 / 誤った宛先）に届きうる
- **medium** — 上記に直結しないが、認証・認可・秘密情報の取り扱いに実害のある不備
- **low** — 実際の悪用手順を示せないもの → **報告しない**
