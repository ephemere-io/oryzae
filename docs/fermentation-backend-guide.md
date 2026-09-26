# Fermentation コンテキスト ドメイン知識

発酵は、瓶に漬けたエントリーを問いごとに LLM が読み、手紙・言葉・抜粋・ワークシートを
返す仕組み。実装は `apps/server/src/contexts/fermentation/`。レイヤー構成と依存ルールは
`docs/backend-architecture-guide.md` に従う。

---

## ドメイン概念

### FermentationResult（発酵 1 回）

- 問い × 対象期間ごとの 1 行（`fermentation_results`）。`status` は
  `pending → processing → completed / failed`
- 出力（`letters` / `keywords` / `extracted_snippets` / `analysis_worksheets`）は
  `fermentation_result_id` でぶら下がる。走査したエントリーは `fermentation_scanned_entries`
- `read_at`: 手紙を開いた時刻。`NULL` は未読。**既読の正はここ**（client の localStorage は
  表示の補助で、サーバの旗を上書きしない）

### 走査対象

`entries.fermentation_enabled = true`（瓶に漬けた）かつ active な問いに結ばれたエントリー。
問いに結ばれていないエントリーは発酵ループに入らない（client は漬ける前に問いを決めさせる）。

---

## 発火の経路

| 経路 | 入口 | 発火条件 | `user_fermentation_state` | メール |
| --- | --- | --- | --- | --- |
| 定期 | cron → `ScheduledFermentationUsecase` | 文字数ゲート（ja 1000 字 / en 500 語）＋ 前回からランダム 24–168h | 更新する | digest を送る |
| 初めての手紙 | `POST /api/v1/fermentations/first-letter` → `FireFirstLetterUsecase` | **発酵の行が 1 つも無い**ユーザーが漬けた直後。ゲートは飛ばす | 触らない | 送らない |
| 強制発火（admin） | `POST /api/v1/admin/fermentations/fire` → `FireFermentationUsecase` | 無条件（デバッグ用） | 触らない | 任意 |

### 初めての手紙

定期発酵はゲートを越えるまで何も返さないので、初めての人は「漬けたのに何も起きない」で
終わる。そこで**一度も発酵の行が無いユーザーに限り**、いちばん最近漬けたエントリーが結ばれた
active な問いへ、その場で 1 通発火する。

- 実際の発火は `FireFermentationUsecase` に委ねる（同じくゲートをバイパスし、対象は
  「その問いに結ばれたエントリー全部」。初めての人は通常 1 通なので実質いま漬けたもの）
- `user_fermentation_state` は触らない — 以後の定期発酵はこの 1 通が無かったものとして動く
- 初回かどうかはサーバが判定する。client（`useFirstLetter`）は漬けるたびに呼んでよく、
  2 回目以降は `{ fired: false, reason: 'not-first' }` で何もしない
- LLM を同期で回す（`POST /` と同じ枠でレート制限）。client は待たずに画面を進め、
  `fired` が立ったら未読の手紙を取り直す。PC は `/jar?justPickled=1` に着いた瓶の page が、
  SP は納めたあとも留まる編集画面の page が頼む
- 失敗は Discord に出す（本文は載せない）。client には投げない — 手紙は定期発酵でも届く

---

## 既読

- `POST /api/v1/fermentations/read` `{ questionId }` → `{ marked }`。その問いの完了した
  発酵のうち `read_at` が空の行に今の時刻を書く。**問い単位・冪等**（受信箱が問いごとに
  最新 1 通しか出さないので、手紙 id 単位だと古い手紙が「開けないのに未読」で残る）
- ヘルプの五歩 ⑤ `hasReadLetter`（`GET /api/v1/users/me`、user コンテキスト）は
  `read_at IS NOT NULL` の行の有無。届いただけの手紙は数えない
- client の順序（`use-unread-letters.ts`）: 手元の既読を立てる → `POST /read` → 合図
  `'read'`（`lib/activity`）→ ヘルプが `/users/me` を取り直す。合図を先に出すと旧い旗を
  読んで ⑤ が進まない

---

## ユーザー向け API

| メソッド | パス | 役割 |
| --- | --- | --- |
| `GET` | `/api/v1/fermentations` | ユーザーの全発酵（`?questionId=` で問い単位） |
| `GET` | `/api/v1/fermentations/readiness` | 瓶の見た目用 readiness（逆算の材料は返さない） |
| `GET` | `/api/v1/fermentations/:id` | 手紙・言葉・抜粋・ワークシート・もとの記録 |
| `POST` | `/api/v1/fermentations/read` | 既読（問い単位、冪等） |
| `POST` | `/api/v1/fermentations/first-letter` | 初めての手紙（初回のみ発火） |
| `POST` | `/api/v1/fermentations` | 手動発酵（レート制限つき） |

認可は RLS（`fermentation_results.user_id = auth.uid()`）。ロケール解決
（`auth.admin.getUserById`）だけ service role が要り、`fermentations.ts` は許可リストに載る。
