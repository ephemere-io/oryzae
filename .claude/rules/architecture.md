---
paths:
  - "apps/server/src/**/*.ts"
---

# サーバーアーキテクチャルール

設計の正は `docs/OryzaeArchitecture.md` を参照すること。以下は要点のみ。

## レイヤー依存方向（絶対ルール）

```
presentation → application → domain ← infrastructure
```

- domain は自分自身以外を import しない（shared/domain のみ例外）
- application は domain のみ import する（infrastructure を直接参照しない）
- infrastructure は domain の gateways + models のみ import する
- presentation は application + infrastructure を import する（DI 組み立てのみ）

## ドメインモデルパターン

private constructor + create/fromProps/withXxx/toProps。詳細は `docs/OryzaeArchitecture.md` セクション5。

## エラーの流れ

domain: Result<T,E> を返す → application: throw に変換 → presentation: HTTP に変換。詳細は `docs/OryzaeArchitecture.md` セクション6。
