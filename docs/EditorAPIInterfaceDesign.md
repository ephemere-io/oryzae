# Editor API Interface Design

# Editor API Interface Design

ジャーナルエントリの型を「基礎」と「エディタ固有」に分離し、エディタをスイッチ可能にする設計。

---

## 問い

**何が基礎で、何がエディタ固有の型か？**

---

## 分離

```
┌─────────────────────────────────────────────────┐
│  Editor Extension (エディタ固有 = opaque JSON)    │
│                                                   │
│  サーバーは中身を解釈しない。                       │
│  保存して返すだけ。スキーマの責任はエディタ側。     │
├─────────────────────────────────────────────────┤
│  Base Entry (基礎 = typed JSON)                   │
│                                                   │
│  id, content, mediaUrls, createdAt, updatedAt     │
└─────────────────────────────────────────────────┘
```

- **Base Entry**: エディタに依存しないジャーナルの本質。サーバーが理解し、AI分析・発酵・検索に使う。変更は全エディタに波及するため最小限に留める。
- **Editor Extension**: エディタをそのエディタたらしめているもの全て。サーバーにとっては中身の見えないJSON（opaque JSON）。保存して返すだけ。

---

## Base Entry

全フィールド必須。

```tsx
interface BaseEntry {
  id: string              // 一意識別子
  content: string         // プレーンテキスト。分析・発酵・検索の燃料
  mediaUrls: string[]     // 添付メディアのURI群（順序のみ保持）
  createdAt: string       // ISO 8601
  updatedAt: string       // ISO 8601
}
```

- title はサーバーが content から自動生成できる
- メディアの caption, type, position 等はエディタ固有

---

## Editor Extension

サーバーは `Record<string, unknown>` として保存・返却する。中身の解釈は `editorType` + `editorVersion` を知るクライアント側の責務。

```tsx
// バックエンド — 型を知らない
extension: Record<string, unknown>

// TypeTrace エディタ（フロント） — 自分だけが型を知っている
extension: TypeTraceExtension
```

以下は TypeTrace エディタが extension に入れるデータの参考例。この型はバックエンドには存在せず、エディタのフロントエンドコードだけが持つ。

### TypeTrace Editor (editorType: "typetrace")

```tsx
interface TypeTraceExtension {
  // リッチテキスト・レイアウト
  contentHTML: string
  writingMode: 'vertical' | 'horizontal'
  openedAt: string

  // Writing Metrics
  averageWPM: number
  peakWPM: number
  slowestWPM: number
  totalDeletedCharCount: number
  totalOpenTime: number

  // 削除履歴
  deletedBlocks: { text: string; time: string }[]

  // 視覚演出
  eraserTraceEnabled: boolean
  erasureTraces: ErasureTrace[]
  ghost: GhostConfig
  timeInscription: { enabled: boolean; mode: string }
  userFontSize: number
  darkMode: boolean
  voiceEnabled: boolean
}
```

---

## DB設計

```sql
-- 最新状態（typed JSON。サーバーが分析・検索に使う）
entries
  id, content, media_urls, created_at, updated_at

-- 保存のたびに1行追記（immutable）
entry_snapshots
  id, entry_id, content, editor_type, editor_version, extension(jsonb), created_at
```

---

## 運用の具体例

### Case 1: TypeTrace で記事を書いて保存

```
entries
  id: entry-001
  content: "今日、カント君の展示に行った。"
  updated_at: 2026-03-15T10:30

entry_snapshots
  ① entry-001, "今日、カント君の展示に行った。", typetrace, 1.0.0,
     { erasureTraces: [...], ghost: {mode:"block",...}, averageWPM: 6.64, ... },
     2026-03-15T10:30
```

### Case 2: Minimal エディタで同じ記事を編集して保存

entries の content が更新され、snapshot が追記される。

```
entries
  id: entry-001
  content: "今日、カント君の展示に行った。すごく良かった。"  ← 更新
  updated_at: 2026-03-16T20:00

entry_snapshots
  ① entry-001, "今日、カント君の展示に行った。",              typetrace, 1.0.0, { erasureTraces, ... },  2026-03-15T10:30
  ② entry-001, "今日、カント君の展示に行った。すごく良かった。", minimal,   1.0.0, { darkMode: true },      2026-03-16T20:00  ← 追加
```

### Case 3: TypeTrace で再び開く

最新の snapshot（②）は minimal → TypeTrace の extension は復元できない → **新規セッションとして開始**。

content は entries から最新を取得:

- content: "今日、カント君の展示に行った。すごく良かった。"
- extension: 新規初期化（erasureTraces: [], averageWPM: 0, ...）

### Case 4: TypeTrace で編集して保存

```
entries
  id: entry-001
  content: "今日、カント君の展示に行った。大きな発見があった。"  ← 更新
  updated_at: 2026-03-17T09:00

entry_snapshots
  ① entry-001, "今日、カント君の...",              typetrace, 1.0.0, { erasureTraces(古), ... },  2026-03-15T10:30
  ② entry-001, "今日、カント君の...すごく良かった。", minimal,   1.0.0, { darkMode: true },          2026-03-16T20:00
  ③ entry-001, "今日、カント君の...大きな発見が...",  typetrace, 1.0.0, { erasureTraces(新), ... },  2026-03-17T09:00  ← 追加
```

### Case 5: TypeTrace で再び開く（今度は復元できる）

最新の snapshot（③）は typetrace → **extension を復元**。

- content: entries から最新
- extension: ③の { erasureTraces(新), ... }

### Case 6: TypeTrace がバージョンアップ（v1.0.0 → v1.1.0）

最新の snapshot（③）は typetrace v1.0.0 → v1.1.0 のコードが読み込む。

```tsx
function loadExtension(snapshot) {
  const ext = snapshot.extension
  if (snapshot.editorVersion < "1.1.0") {
    ext.soundEffect = { enabled: false, type: "typewriter" }  // デフォルト補完
  }
  return ext
}
```

保存すると v1.1.0 の snapshot が追記される:

```
entry_snapshots
  ① typetrace, 1.0.0, { ... },                          2026-03-15
  ② minimal,   1.0.0, { darkMode: true },                2026-03-16
  ③ typetrace, 1.0.0, { erasureTraces(新), ... },        2026-03-17
  ④ typetrace, 1.1.0, { erasureTraces(新), soundEffect: {...}, ... },  2026-03-18  ← 追加
```

---

## Extension のバージョニング

サーバーは extension を opaque JSON として保存するため、DBマイグレーションは不要。スキーマが変わった時の整合性はエディタ側のコードが `editorVersion` を見て担保する。

### エディタ側のマイグレーションコード

```tsx
function loadExtension(snapshot): TypeTraceExtension {
  const ext = snapshot.extension

  if (snapshot.editorVersion < "1.2.0") {
    // ghost.blurStart/End → ghost.blur.start/end に構造変更
    ext.ghost = {
      ...ext.ghost,
      blur: { start: ext.ghost.blurStart, end: ext.ghost.blurEnd }
    }
  }

  if (snapshot.editorVersion < "1.1.0") {
    ext.soundEffect = { enabled: false, type: "typewriter" }
  }

  return ext as TypeTraceExtension
}
```

---

## 現在の IndexedDB 型の分解

| フィールド | → Base / Extension |
| --- | --- |
| id, content | Base |
| createdAt, updatedAt | Base |
| title | Extension（サーバーが content から自動生成） |
| contentHTML, writingMode, openedAt | Extension (TypeTrace) |
| averageWPM, peakWPM, slowestWPM | Extension (TypeTrace) |
| totalDeletedCharCount, totalOpenTime | Extension (TypeTrace) |
| deletedBlocks | Extension (TypeTrace) |
| eraserTraceEnabled, erasureTraces | Extension (TypeTrace) |
| ghost*, timeInscription* | Extension (TypeTrace) |
| userFontSize, darkMode, voiceEnabled | Extension (TypeTrace) |

---

*作成: 2026-03-15*