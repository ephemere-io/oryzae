# Editor Effects Persistence

エディタの視覚エフェクト（消し跡・時間内包・圧力にじみ・音量内包）をエントリ単位で永続化する設計。

## 対象エフェクト

| エフェクト | 元データの所在 | 保存対象 |
|---|---|---|
| 消し跡 (`use-eraser-trace`) | Canvas に描画、`tracesRef` (in-memory) | `Trace[]` をそのまま JSON 化 |
| 時間内包 fontSize / fontWeight (`use-time-inscription`) | `<span class="eblock" data-t data-duration data-mode>` | テキスト文字オフセット + 属性 |
| 時間内包 圧力にじみ (`use-pressure-bleed`) | `<span class="eblock" data-intensity data-seed data-mode="pressureBleed">` | テキスト文字オフセット + 属性 |
| 音量内包 (`use-voice-dynamics`) | `<span class="v-block" style="fontSize">` | テキスト文字オフセット + fontSize |
| ゴーストエフェクト | アニメ後すぐ消える | **対象外**（演出のみ） |

## SSoT と キャッシュ

- **SSoT**: `entries.effects` JSONB カラム（新設）。
- **キャッシュ**: `localStorage` キー `oryzae-entry-effects:<entryId>`。書き込みは「保存成功時」と「extract した直後（即時反映用）」。読み込みは「エントリ取得前の即時表示」と「DB から取れなかった場合のフォールバック」。
- DB レスポンスを取得したら必ず localStorage を上書きする（DB が SSoT）。

## 保存形式

```ts
type EditorEffectsState = {
  version: 1;
  eraserTraces?: EraserTrace[];      // canvas marks
  textSpans?: TextSpanMark[];        // DOM marks (sorted by start, non-overlapping)
};

type EraserTrace = {
  rx: number; ry: number;            // editor content coords (Issue #313)
  w: number; h: number;
  chars: string[];
  intensity: number;
  seed: number;
};

type TextSpanMark =
  | { start: number; end: number; kind: 'time'; mode: 'fontSize' | 'fontWeight'; t: number; duration: number }
  | { start: number; end: number; kind: 'pressure'; intensity: number; seed: number }
  | { start: number; end: number; kind: 'voice'; fontSizeEm: number };
```

`start` / `end` は **保存される `content` 文字列上のオフセット**（半開区間、`\n` を 1 文字とカウント）。

## 文字オフセットの数え方

`editorRef.current.innerText` と一致するインデックスを使う。理由:
- 既存の保存ロジックも `innerText` を採用しており、改行（`<div>`, `<br>`）が `\n` 1 文字に正規化される。
- 復元時は同じ `innerText` 経由で構築した text nodes をスキャンしてマーキングするので、エンコード→デコードが対称。

## 復元アルゴリズム（apply）

1. `editorRef.current.textContent = content` で素のテキストを書く（既存挙動）。
2. `textSpans` を `start` 昇順で走査し、editor の最初の text node から文字数を数えながら `[start, end)` の範囲を `<span>` で wrap。
3. `kind` に応じて `class` / `data-*` / `style` を復元。
4. `eraserTraces` を `useEraserTrace` の `initialTraces` prop として渡し、初回 mount 時に `tracesRef.current = initialTraces` で hydrate → `requestRedraw()`。

## 抽出アルゴリズム（extract）

1. editor の `innerText` を計算 (`content`)。
2. 子ノードを DFS で走査し、`<span class="eblock|v-block">` を見つけたら、その時点までの累積文字数を `start` として記録、`end = start + textContent.length`。
3. `dataset` / `style.fontSize` を読んで `TextSpanMark` を組み立て。
4. `tracesRef.current` から `eraserTraces` をスナップショット。

## 既存エントリとの互換性

- 既存 entries には `effects` がない → カラムは `default '{}'`、`null` の場合は無視。
- 既存の保存ロジックは `content` のみ送信していたので、payload に `effects` を含めるのは追記のみ（破壊的変更なし）。

## スコープ外（別途検討）

- 全文検索ヒット時のハイライト等は plain text に対して行う前提のまま。
- snapshot (`entry_snapshots`) への effects 同期は今回は見送り（必要になれば次フェーズ）。
- vertical writing mode での `rx/ry` 座標系の整合性は Issue #313 の修正に乗っている前提。

## テスト戦略

- **server**: domain ラウンドトリップ、repository インテグレーション（DB skipif）、route handler。
- **client**: `extract` / `apply` の対称性、空 state の no-op、未知の kind を無視するフォワード互換性、`useEraserTrace` の hydration。
- **手動 QA**: 各エフェクトを ON にして保存 → 一覧 → 開き直し で痕跡が再表示されることを確認。
