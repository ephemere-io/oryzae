# i18n ガイド（apps/client）

`apps/client` の UI 文言は日英バイリンガル対応。SSoT は **Google Spreadsheet**、ランタイムは **next-intl** を使う。

## アーキテクチャ

```
Google Spreadsheet (oryzae-i18n)        ← SSoT。日英対応表（key, ja, en, file, line, context）
        │
        │  pnpm i18n:sync
        ▼
apps/client/src/i18n/messages/{ja,en}.json   ← ネスト構造の messages（git 管理）
        │
        ▼
next-intl (apps/client/src/i18n/request.ts)  ← cookie `NEXT_LOCALE` から locale 決定
        │
        ▼
useTranslations('namespace') in components
```

- ロケール切替は **URL routing 不採用**。`NEXT_LOCALE` cookie で永続化（`/lib/i18n-actions.ts` の `setLocaleAction`）。
- 言語切替UIは `components/ui/locale-switcher.tsx`（PoC段階。最終的にはアカウント設定に統合予定）。
- デフォルト locale は `ja`、サポート locale は `ja`/`en`（`apps/client/src/i18n/config.ts`）。

## 翻訳の追加・編集フロー

1. **Spreadsheet を編集**: https://docs.google.com/spreadsheets/d/1GThXIAh0ZsIl5POxyLKYfSulz2Y_f1rBpTzSL98brkY/
2. **同期**: ローカルで `pnpm i18n:sync`（Google Sheets の公開エクスポートURLからCSVを取得して `messages/*.json` を再生成）
3. **commit & push**: `messages/*.json` の差分を含めてコミット

新規キーをコードから先行追加したい場合:
1. `messages/ja.json` と `messages/en.json` に手で追記（後で Spreadsheet にも反映）
2. または、Spreadsheet に先に行を足してから `pnpm i18n:sync`

## キー命名規則

`<feature>.<context>.<purpose>` のローワースネーク 3 階層。

例:
- `auth.login.submit` — auth feature の login コンテキストの送信ボタン
- `entries.editor.placeholder` — entries feature のエディタのプレースホルダ
- `fermentation.jar.add_question` — fermentation feature の jar の問い追加ボタン

JSON はネスト構造で出力されるため、コンポーネントでは:

```tsx
const t = useTranslations('auth.login');
<button>{t('submit')}</button>
```

## CSV フォーマット

Spreadsheet（およびローカル `.tmp/i18n-inventory.csv`）のカラム:

| カラム | 内容 |
|---|---|
| `key` | ドット区切りの階層キー |
| `ja` | 日本語訳 |
| `en` | 英訳 |
| `file` | 元コードのファイルパス（参考） |
| `line` | 元コードの行番号（参考） |
| `context` | 用途説明（人間用、翻訳判断のヒント） |

`file` / `line` / `context` は同期スクリプトが無視する。Spreadsheet 上で翻訳作業の参考にするためだけのメタ情報。

## ICU 変数

next-intl は ICU MessageFormat をサポート。`{count}` のような変数は messages 値の中に書ける:

```json
{
  "entries": {
    "list": {
      "results_count": "{count}件の結果"
    }
  }
}
```

```tsx
t('entries.list.results_count', { count: 12 });
```

## スクリプトの仕組み

`apps/client/scripts/build-i18n.mjs`:

- `--remote` フラグまたは `ORYZAE_I18N_CSV_URL` 環境変数 → Spreadsheet からfetch
- `--csv=<path>` → ローカル CSV ファイル
- 引数なし → `.tmp/i18n-inventory.csv`（dev 用フォールバック）

CSV → ネスト JSON 変換は `setNested()` がドット区切りキーを再帰的に展開する。

## Spreadsheet の権限

公開エクスポートを使うため、Spreadsheet は **「リンクを知っている全員が閲覧可」** に設定する必要がある。編集は所有者のみで OK。

社外秘の翻訳を扱う必要が出た場合は、Service Account + Google Sheets API v4 への切替を検討する（`googleapis` パッケージ）。

## 言語追加時の手順

将来 `zh` を追加する場合の例:

1. `apps/client/src/i18n/config.ts` の `LOCALES` に `'zh'` を足す
2. Spreadsheet に `zh` カラムを足して翻訳を入れる
3. `build-i18n.mjs` を改修して `zh` カラムを読む（または可変にして `LOCALES` をループ）
4. `pnpm i18n:sync` → `messages/zh.json` 生成
5. UI の locale switcher を3言語対応に変更

## 既知の未対応領域

- ランディングページ（`apps/client/src/features/landing/`）は独自の i18n 実装（`landing/i18n.ts`）を持っており、本ガイドのフレームワークには未統合。
- `apps/admin` は i18n 未対応（admin の文言は日本語のみ）。
