# Strategy A: スナップショット比較（デグレテスト）

変更前後のUI表示を比較し、PRによるリグレッションがないことを確認する。

**注意: この戦略はブランチ切り替えと localhost 再起動が必要なため、ユーザーの手作業が発生する。大半のテストは Strategy B/C で完結するので、Strategy A は「厳密なデグレ確認が必要なとき」のオプションとして使う。**

## いつ使うか

- PRがUI表示ロジック、コンポーネント構造に変更を加えている
- 「既存の動作に影響がないこと」を確認したい

## 手順

### 1. ベースライン取得（変更前ブランチ）

**ユーザーにブランチ切り替えを依頼する。** 以下の手順を提示すること:

```
git stash
git checkout main
pnpm --filter @oryzae/server dev
pnpm --filter @oryzae/client dev
```

localhost が起動したら:
1. ログインして対象ページへ遷移
2. take_snapshot filePath=/tmp/baseline-{testname}.txt
3. take_screenshot filePath=/tmp/baseline-{testname}.png

### 2. テスト対象取得（PRブランチ）

```
git checkout <pr-branch>
git stash pop
pnpm --filter @oryzae/server dev
pnpm --filter @oryzae/client dev
```

同一ページで:
1. take_snapshot filePath=/tmp/pr-{testname}.txt
2. take_screenshot filePath=/tmp/pr-{testname}.png

### 3. 差分比較

1. 両ファイルからキーワードを検索して比較
2. 期待通りの差分のみであることを確認
3. 意図しない変更がないことを確認

## 注意点

- 動的データ（エントリの内容等）は変化するため、構造・パターンベースで比較する
