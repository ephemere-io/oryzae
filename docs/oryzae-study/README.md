# 書斎ホーム（Study Home）— 実装引き継ぎ

3D の「書斎」を Oryzae のホームに据え、左サイドバーを撤廃するナビゲーション改造の一式。
**Markdown が正**。プロトタイプ HTML は見た目の答え合わせ用で、コードの移植元ではない。

実装時の決着は `60-implementation-notes.md` にある（仕様書より新しい）。

| ファイル | 中身 |
| --- | --- |
| `00-overview.md` | 画面・遷移・状態の定義（仕様の本体） |
| `10-data-contract.md` | 型と API 応答例、上流に足りないもの |
| `20-3d-component.md` | 3D シーンの移植用コンポーネント設計 |
| `21-3d-parameters.md` | 座標・尺度・イージングの実測値 |
| `30-branch-and-commits.md` | ブランチ名とコミット分割 |
| `40-acceptance.md` | 受け入れ基準チェックリスト |
| `50-rollout.md` | フラグ付きの段階リリース手順 |
| `mock/study-state.presets.json` | 6状態のモックデータ（プロトタイプと同一） |
| `60-implementation-notes.md` | **実装時に判明した仕様と実コードのズレ・その決着** |

## 参照プロトタイプ

参照プロトタイプ `oryzae-study-v1.0.html`（6.2MB・three.js r128 + 素の DOM）は
**リポジトリに取り込んでいない**。マージ時点で本番コードが唯一の正になるため、
古くなる 6MB のバイナリ相当物を履歴に残さない判断（README 末尾の方針そのまま）。
必要なら仕様一式の配布元から取得する。

数値の正は `21-3d-parameters.md`、構造の正は `20-3d-component.md`。

## 前提と割り切り

- 対象リポジトリ: `ephemere-io/oryzae` / branch `main`（`apps/client`）。
- jar / board / entry の各画面そのものは**現行 UI のまま**。変えるのはナビゲーションと入口だけ。
- 発酵 readiness は上流に存在しない値。`10-data-contract.md` の「不足しているもの」を先に決める必要がある。
- マージ後はこのプロトタイプではなく**本番コードを正とする**。細かいモーション調整のために
  ここへ戻らないよう、duration / easing / カメラ距離は1箇所の定数にまとめておく。
