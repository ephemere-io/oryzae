# フロントエンドテスト・ガードレールガイド

フロントエンド（`apps/client` および `apps/admin`）のテスト戦略と品質ガードレールの原則。
両アプリに同一のルールが適用される。

---

## テスト戦略

### フレームワーク

| ツール | 役割 |
| --- | --- |
| Vitest | テストランナー・アサーション（サーバーと統一） |
| React Testing Library | コンポーネント・hooks のレンダリングテスト |
| jsdom | ブラウザ環境のエミュレーション |

**なぜこの構成か**: サーバー側と同一のテストランナー（Vitest）を採用することで、設定・書き方・CI パイプラインを統一し、学習コストと保守コストを最小化する。

---

## テスト対象の優先順位

| 優先度 | 対象 | 方針 |
| --- | --- | --- |
| P0 | カスタム hooks（useAuth, useEntries, useQuestions） | API 呼び出し・状態管理のロジックを網羅的にテスト |
| P1 | バリデーション統合（@oryzae/shared の Zod スキーマ利用） | スキーマの正常値・異常値の境界をテスト |
| P2 | ロジックを含む UI コンポーネント | 条件分岐レンダリング・イベントハンドラの動作検証 |

### テストしないもの

- **薄いページラッパー（`app/`）** — ルーティング層は Next.js フレームワークの責務であり、ユニットテストの費用対効果が低い
- **純粋なレイアウト / スタイリング** — 視覚的な正しさはユニットテストで検証できない。将来的に必要であれば VRT（Visual Regression Testing）を別途導入する

---

## テストファイル配置

```
apps/{client,admin}/
├── src/features/
│   ├── auth/
│   │   └── hooks/useAuth.ts
│   └── {feature}/
│       └── hooks/use-{name}.ts
└── test/features/          ← src/features/ のミラー構造
    ├── auth/
    │   └── hooks/useAuth.test.ts
    └── {feature}/
        └── hooks/use-{name}.test.ts
```

- テストファイルは `test/features/` 配下に、`src/features/` のディレクトリ構造をミラーして配置する
- インポートは `@/` エイリアスを使用する（例: `import { useAuth } from '@/features/auth/hooks/useAuth'`）

**なぜソースと分離するか**: テストコードをビルド対象から明確に除外し、`src/` の見通しを良く保つため。ミラー構造により対応関係は一目でわかる。

---

## モックパターン

### 原則

- **`vi.fn()` による手動スタブのみ使用する。** MSW 等のモックライブラリは導入しない（サーバーと統一）
- fetch をグローバルモックし、API レスポンスをテストケースごとに差し替える

### fetch のグローバルモック

```ts
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});
```

### hooks テストの典型パターン

```ts
import { renderHook, waitFor } from '@testing-library/react';
import { useEntries } from '@/features/entry/hooks/useEntries';

describe('useEntries', () => {
  it('エントリ一覧を取得できる', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ entries: [{ id: '1', title: 'テスト' }] }),
    });

    const { result } = renderHook(() => useEntries());

    await waitFor(() => {
      expect(result.current.entries).toHaveLength(1);
    });
  });

  it('API エラー時にエラー状態になる', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const { result } = renderHook(() => useEntries());

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });
  });
});
```

**なぜ手動スタブか**: モックライブラリの暗黙的な振る舞いに依存せず、テストコードだけを読めば何が起きているか理解できる。サーバー側と同じ方針を採ることでチーム全体の認知負荷を下げる。

---

## ガードレールスタック

### 原則

「LLM に頼むより道具に強制する」 — CLAUDE.md に「lint しろ」と書くのと、Hook が lint を実行するのでは、「ほぼ毎回」と「例外なく毎回」の差がある。

### 3段構えの品質チェック

| タイミング | チェック | なぜこのタイミングか |
| --- | --- | --- |
| pre-commit | 変更ファイルの biome format + lint | コミットごとにコードスタイルを統一 |
| pre-push | lint + typecheck | push 前に型エラーを防ぐ |
| CI | lint + typecheck + test + dep-cruise + knip | PR マージ前に全品質を保証 |

**`--no-verify` は原則禁止。** フック失敗時は必ず修正する。

---

## テスト作成ルール

1. **新しい hook またはロジックを作成したら、対応するテストを必ず作成する。テストなしで完了とみなさない。**
2. 正常系と異常系の両方をカバーする
3. テストデータは最小限にし、テスト対象に直接関係するフィールドだけ設定する
4. テスト名は日本語で、何を検証しているかが一目でわかるように書く（例: `'認証トークン期限切れ時にリフレッシュする'`）
5. `any` 型禁止 — テストコードでも型安全性を保つ
