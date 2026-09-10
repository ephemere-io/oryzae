# 20 — 3D シーンの移植用コンポーネント設計

## 置き場所

```
apps/client/src/features/shared/study/
  types.ts                     StudyState など（10-data-contract.md）
  hooks/use-study-state.ts     既存 hook を束ねて StudyState を作る
  components/study-home.tsx    <DeviceView pc={<PcStudy/>} sp={<SpStudy/>} /> の中身を出す入口
apps/client/src/features/pc/study/
  components/study-canvas.tsx  three.js の実体（'use client'、SSR しない）
  components/study-chrome.tsx  フローティング UI（マーク・アバター・状態ラベル）
  components/entry-list-overlay.tsx  一覧オーバーレイ
  scene/                       純関数群（React 非依存）
    jar.ts  books.ts  board.ts  camera.ts  materials.ts  constants.ts
```

`scene/*` は three.js だけに依存し、React も Next も知らない。テストしやすくするためと、
`docs/reference-ui/` の素の HTML プロトタイプと同じ関数を共有できるようにするため。

## 分割

```ts
// study-canvas.tsx
export function StudyCanvas({ state, onNavigate, device }: {
  state: StudyState;
  onNavigate: (target: StudyTarget) => void;   // 遷移はここから外に出す
  device: Device;
}) : JSX.Element
```

- `useRef` でコンテナを1つ持ち、`useEffect` で `initScene(container, state, device)` を呼ぶ。
  戻り値は `{ dispose, goTo }`。**cleanup で必ず dispose**（renderer.dispose + コンテナを空に
  + cancelAnimationFrame + ResizeObserver.disconnect）。これを怠ると再マウントで canvas が
  積み上がる（プロトタイプで実際に踏んだ。canvas が15枚できて古い層のイベントだけが生き残る）。
- `state` が変わったら**シーンを作り直す**（差分更新はしない）。書斎の更新頻度は画面遷移と
  同程度で、差分更新の複雑さに見合わない。
- 遷移は `goTo(target)` が Promise を返し、解決後に `onNavigate(target)` → `router.push`。
  カメラが着いてから URL が変わる（クロスフェードの間に遷移する）。
- `prefers-reduced-motion` のときはカメラ移動と開くアニメーションを飛ばし、
  クロスフェードだけにする。

## three.js の入れ方

```
pnpm add three
pnpm add -D @types/three
```

three は**1インスタンスに限る**。プロトタイプは CDN の r128 とデザインシステム同梱分の
2重読み込みになっており（`Multiple instances of Three.js being imported`）、移植時は npm の
`three` へ一本化する。2つ載ると `instanceof` が別コンストラクタで false になる罠がある。

`study-canvas.tsx` は `next/dynamic` で `{ ssr: false }` 読み込みにして、
初期バンドルに three を載せない（`/jar` などを直接開いた人に 600KB を配らない）。

```ts
const StudyCanvas = dynamic(() => import('./study-canvas'), { ssr: false, loading: () => <StudyFallback /> });
```

## 素材（materials.ts）

| 名前 | 中身 |
| --- | --- |
| `solid` | `MeshBasicMaterial` `#FDFCF9`, polygonOffset(1,1) — 線が面に負けないように |
| `paper` | 同上 `#FFFFFF`（写真カード） |
| `ink` | `LineBasicMaterial` `#1A1918` |
| `faint(o)` | `ink` + `transparent`, opacity o（0.1–0.4） |
| `xray` | `{ depthTest: false, depthWrite: false }` を混ぜたもの（瓶の中身） |

ダークテーマ（`[data-theme="dark"]`）では `#1a1a1a` 地に `#cccccc` 線へ入れ替える。
`theme-context` の値を `initScene` に渡し、テーマ変更時は作り直す。

## 瓶の退場（SP のボード遷移）

`initScene` の中で瓶の素材を専用インスタンスに clone し、`{ material, baseOpacity }` の配列で
持っておく。`setJarOpacity(v)` が `baseOpacity × v` を書き、`v <= 0.02` で瓶体と封を
`visible = false` にする。ボード遷移の第2段と、書斎への復帰（1 へ戻す）だけが呼ぶ。

素材を共有したまま不透明度を触ると机やボードまで一緒に消えるので、clone は必須。
輪郭線の材質だけは別扱いで、毎フレームの呼吸計算に `jarFade` を掛ける。

## 当たり判定

見た目のメッシュではなく**不可視のヒットボックス**（`MeshBasicMaterial({ visible: false })`）を
使う。瓶は円柱、手帳は各冊を囲む箱、棚は背表紙ごと、ボードは板より 0.2 大きい箱。
`hit.parentGroup = group` を張って `intersectObjects` の結果から一発で親を引く。
ホバーは `scale 1.02` とカーソルだけ（色は変えない）。

タッチでは `pointermove` が `click` より先に来ない端末があり、`hovered` が空のままになる。
`click` ハンドラの中で `hovered` が無ければその場で再度レイキャストする。

## 輪郭線

瓶の輪郭は毎フレーム解き直す（`21-3d-parameters.md`「側面の輪郭線」）。頂点バッファは
一度だけ確保し、`setDrawRange` で使う分だけ描く。`Line` は `frustumCulled = false`
（頂点を毎フレーム書き換えるので既定の bounding sphere が当てにならない）。

## 描画コスト

面は全て `MeshBasicMaterial`（ライト無し）、影も無し。ドローコールはボードのカード数に
比例して増えるので、カードは `zIndex` 順に**最大30枚**で打ち切る（それ以上は貼らない）。
`setPixelRatio(Math.min(devicePixelRatio, 2))`。
