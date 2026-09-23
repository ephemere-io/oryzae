# i18n ガイド（apps/client）

`apps/client` の UI 文言は 4 言語（ja / en / zh / ko）。**SSoT は `messages/*.json` そのもの**、
ランタイムは **next-intl** を使う。

## アーキテクチャ

```
apps/client/src/i18n/messages/{ja,en,zh,ko}.json   ← SSoT。直接編集する（git 管理）
        │
        ▼
next-intl (apps/client/src/i18n/request.ts)  ← cookie `NEXT_LOCALE` から locale 決定
        │
        ▼
useTranslations('namespace') in components
```

- ロケール切替は **URL routing 不採用**。`NEXT_LOCALE` cookie で永続化（`/lib/i18n-actions.ts` の `setLocaleAction`）。
- デフォルト locale は `ja`。対応 locale は `apps/client/src/i18n/config.ts` の `LOCALES`。
- 言語切替 UI は `components/ui/locale-switcher.tsx`。

### かつて Google Spreadsheet が SSoT だった（2026-09 に廃止）

`oryzae-i18n` スプレッドシートを正とし、`pnpm i18n:sync` で JSON を生成していた。
**やめた理由は、実際にそう運用されていなかったから。** シートの最終更新は 2026-05-16 で、
以後 4 ヶ月ぶんの文言は JSON に直接足され続けていた。つまり「正」であるはずのシートが
4 ヶ月古く、同期スクリプトを回すと**それらが巻き戻る**状態だった。

AI で書くぶんには JSON を直接触るほうが速い、という実感とも噛み合っている
（2026-09-23、オーナーとレビュアーで合意）。スクリプト `build-i18n.mjs`、
`pnpm i18n:sync` / `i18n:build`、`google-sheets` MCP 登録はすべて削除済み。

## 翻訳の追加・編集フロー

1. **`messages/*.json` を直接編集する。4 言語すべてに同じキーを足す**
2. commit & push

**4 言語のキーが揃っていることは `apps/client/test/architecture/i18n-vocabulary.test.ts`
が機械で見ている。** 1 言語だけ足し忘れるとテストが落ちる。

同じテストが「短い名前は正式名称の短縮形であること」も見ている。同じ物を端末ごとに
違う名前で呼ばないための歯止めで、語そのものではなく**関係**を見るので言語を問わず効く
（SP の道具箱でスニペットを「抜粋」と書いて指摘された実例から入れた）。

## キー命名規則

`<feature>.<context>.<purpose>` のローワースネーク 3 階層。

例:
- `auth.login.submit` — auth feature の login コンテキストの送信ボタン
- `entries.editor.placeholder` — entries feature のエディタのプレースホルダ
- `fermentation.jar.add_question` — fermentation feature の jar の問い追加ボタン

JSON はネスト構造なので、コンポーネントでは:

```tsx
const t = useTranslations('auth.login');
<button>{t('submit')}</button>
```

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

## 言語を足すとき

1. `apps/client/src/i18n/config.ts` の `LOCALES` と `LOCALE_OPTIONS` に足す
2. `messages/<locale>.json` を作り、既存言語と**同じキー集合**で埋める
3. `pnpm test` でキーの過不足を確認（`i18n-vocabulary.test.ts`）

## 既知の未対応領域

- ランディングページ（`apps/client/src/features/landing/`）は独自の i18n 実装（`landing/i18n.ts`）を持っており、本ガイドのフレームワークには未統合。
- `apps/admin` は i18n 未対応（admin の文言は日本語のみ）。
