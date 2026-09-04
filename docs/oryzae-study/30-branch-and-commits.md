# 30 — ブランチとコミット分割

## ブランチ

```
feat/study-home-3d
```

`main` から切る。フラグ既定 OFF で main にマージできる形を保つ（`50-rollout.md`）。

## コミット

1. `chore: add three.js and study feature scaffolding`
   `three` / `@types/three` の追加、`features/shared/study/types.ts`、空の `features/pc/study/scene/`。
2. `feat(study): scene primitives for jar, books and board`
   `scene/materials.ts`, `jar.ts`, `books.ts`, `board.ts`, `camera.ts`, `constants.ts`。React 非依存の純関数のみ。
   ここまでは画面に出ない。ユニットテスト（座標変換・厚み・bbox フィット）を同梱。
3. `feat(study): StudyCanvas with navigation targets`
   `study-canvas.tsx`（dispose を含む）、ヒットボックス、ホバー、`goTo` の Promise。
4. `feat(study): study state from existing hooks`
   `use-study-state.ts`。既存の `use-entries` / `use-board` / `use-questions` / `useUnread` を束ねる。
   readiness は `10-data-contract.md` の案 B（クライアント近似）で入れ、TODO を残す。
5. `feat(study): floating chrome and entry list overlay`
   `study-chrome.tsx`, `entry-list-overlay.tsx`。サイドバーはまだ触らない。
6. `feat(study): mount study home behind a flag`
   `app/(protected)/study/page.tsx` と `DeviceView`。フラグ ON のときだけ `/` から `/study` へ。
7. `feat(nav): hide sidebar on study home`
   `(protected)/layout.tsx` の PC シェルを条件分岐（フラグ ON かつ `/study` ではサイドバーを描かない）。
8. `feat(study): sp top-down composition`
   SP 構図とタップ遷移、`prefers-reduced-motion`。
9. `feat(study): sp touch affordances`
   ラベルを押せるピルに（`min-height: 44px`・状態語・`›`）、`click` 内での再レイキャスト、
   棚の前傾と背文字、一覧の月チップ。`00-overview.md`「SP の当たりと注釈」。
10. `feat(board): draggable cards on sp`
   SP のボードから右ペインを外し、カードを `pointerdown` + `setPointerCapture` で動かせるように。
   位置の永続化はしない（この段では見た目だけ）。
11. `feat(api): fermentation readiness endpoint`（サーバー側・別 PR でも良い）
   `GET /api/v1/fermentations/readiness` と `GET /api/v1/entries/monthly-counts`。
   入ったら 4 の近似を差し替える。
12. `docs: study home spec`
    この `docs/oryzae-study/` を取り込む。

1〜5 は画面に出ないので普通にレビューできる。6 以降を分けておくと、
「フラグを消す1コミット」で撤退できる。9・10 は SP だけに閉じるので、PC を壊さずに単独で戻せる。
