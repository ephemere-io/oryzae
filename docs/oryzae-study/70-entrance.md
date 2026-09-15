# 70 — 書斎の扉（ログイン・登録・認証の画面）

認証まわりの画面（`/login` `/signup` `/forgot-password` `/reset-password` `/callback` `/auth/confirm`）の
地を、**書斎の手前にある扉**にする。書斎と同じ線画・同じ紙と墨で描き、ログインできたら扉を押し開けて
奥へ歩き、地の色に溶ける。書斎は同じ地の色から現れるので、ログインの前後が 1 つの廊下の続きになる。

## なぜ

- それまでの認証画面は、白地に中央寄せのフォームだけの SaaS の定型で、書斎の世界と切れていた
- 書体が body 既定の明朝のままで、ラベル・入力欄・ボタンまで明朝だった（`design-language.md` §5 違反）
- Google でログインして戻った `/callback` に、認証レイアウトの言語選択（「日本語」の `<select>`）だけが
  ぽつんと浮き、誰も触る理由の無い画面になっていた

## 画面

| 状態 | 扉 | 紙（フォーム） |
| --- | --- | --- |
| 待っている | わずかに開いていて（`DOOR_ANGLE.rest`）、隙間から奥の格子と書斎の気配が覗く | PC は扉の右に 1 枚立てる / SP は下から敷く |
| 送信中・認証中 | 取っ手に手を掛けたくらい開く（`waiting`）。失敗したら閉じ直す | そのまま |
| 入れた | 紙が退く → 扉を押し開ける → 敷居をまたいで奥へ歩く → 溶ける（`enterPlan`） | 退く |

- 物は**扉・敷物・低い棚と一輪挿し**だけ。棚は「前室」であることを言う唯一の物で、線を足して部屋を説明しない
- 扉の名札は空けておく。名乗るのは紙のほう
- 言語の切り替えは右上の擦りガラスのピル 1 つ。**通り道（`/callback` `/auth/confirm`）では出さない**（`isPassage`）
- 動きを減らす設定では扉もカメラも動かさず、溶かすだけ
- WebGL が無いときは扉が出ないだけで、紙はそのまま使える

## 構造

```
app/(auth)/layout.tsx                         DeviceView で PC / SP を出し分ける
features/pc/auth/components/pc-auth-entrance  構図（ENTRANCE_PC_LAYOUT）を渡すだけ
features/sp/auth/components/sp-auth-entrance  構図（ENTRANCE_SP_LAYOUT）を渡すだけ
features/shared/auth/
  components/auth-entrance.tsx   地（3D）と紙の置き方・溶暗・EntranceContext の提供
  components/entrance-canvas.tsx three.js の入れ物（dynamic import・ssr: false）
  components/auth-status.tsx     通り道の画面の紙（認証中 / 失敗）
  entrance/layout.ts             カメラの配置表
  entrance/door.ts               扉の寸法・開き・歩いて入る段取り（純関数）
  entrance/scene.ts              three.js の組み立て（素材は書斎の createMaterials を共有）
  entrance/context.ts            フォームから扉への操作（useEntrance / useLeaveThroughEntrance）
  entrance/paper.ts              紙の上の部品のクラス（書体・入力欄・ボタン・エラー）
  entrance/passage.ts            通り道の判定・扉の手前に留まる行き先の判定
```

レイアウトに置くので、認証画面どうしを行き来しても扉（WebGL のコンテキスト）は作り直さない。

### フォームと扉の約束

フォームは扉の実体を知らない。`useEntrance()` の 2 つだけを呼ぶ。

- `setWaiting(true/false)` — 送信の前後
- `await enter()` — 認証が通ったあと、**行き先へ移る前**。溶け切ってから resolve する

扉の外（検証ハーネス・テスト）では `enter()` がすぐ解決するので、フォームは単体でも動く。

`useOauthCallback` / `useEmailConfirm` は読み込み直す直前に `beforeLeave(destination)` を待つ。
パスワード再設定（`/reset-password`）のように**扉の手前へ戻る**行き先では扉を開けない（`staysAtEntrance`）。

## 変えていないもの

- 文言（i18n のキー）。E2E が見ている `h1 = Oryzae`・プレースホルダ・ボタン名・`combobox "Language"` はそのまま
- 認証の通信とセッション確定の手順
