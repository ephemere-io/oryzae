# Entry コンテキスト ドメイン知識

Entry（ジャーナルエントリ）のビジネスルールと設計判断。
横断的なアーキテクチャルールは `docs/backend-architecture-guide.md` を参照。

---

## ドメイン概念

### Entry（エントリ）

ユーザーが書く日記テキスト。サーバーが理解し、AI 分析・検索に使う「基礎データ」。

- content はプレーンテキスト。エディタ固有のリッチテキストは含まない
- mediaUrls はメディアの URI 群。メタデータ（キャプション等）はエディタ固有
- mutable: 編集のたびに content と updatedAt が更新される
- バリデーション: content は空文字禁止・上限あり

### EntrySnapshot（スナップショット）

保存のたびに 1 行追記される **immutable な履歴**。Entry と 1:N の関係。

- `extension` は **opaque JSON** — サーバーは中身を解釈しない。保存して返すだけ
- `editorType` + `editorVersion` でどのエディタが書いたかを識別する
- エディタ固有のスキーマ管理はクライアント側の責務（サーバーは opaque として扱う）

### エディタスイッチの判定ロジック

最新 snapshot の `editorType` が要求と一致すれば `extension` を復元可能。不一致なら新規セッション開始。

**なぜこの設計か**: エディタごとにスキーマが異なるため、サーバー側で全エディタの型を管理するのは非現実的。opaque JSON として保存し、クライアントが `editorVersion` を見てマイグレーションすることで、エディタの追加・更新にサーバー変更が不要になる。

---

## ビジネスルール

- エントリの作成時に、Entry レコードと初回 Snapshot を同時に作成する
- エントリの更新時に、Entry レコードの更新と Snapshot の追記を同時に行う
- エントリの削除は cascade で Snapshot も削除される（DB レベル）
- 一覧取得はカーソルベースページネーション（作成日降順）
- 全操作は認証済みユーザーのみ。RLS で他ユーザーのデータにアクセス不可

---

## 設計判断の記録（ADR）

### ADR-001: Base Entry と Editor Extension の型分離

**決定**: サーバーが理解する「基礎データ」（content, mediaUrls）と、エディタ固有の「拡張データ」（extension）を明確に分離する。

**理由**: 複数エディタ（TypeTrace, Minimal 等）をサポートするため。エディタ追加時にサーバー側のスキーマ変更を不要にする。

**詳細**: `docs/archive/EditorAPIInterfaceDesign.md` に初期設計の Case 1-6 を記録。
