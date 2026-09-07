/**
 * 書斎のモーションの唯一の置き場（`docs/oryzae-study/21-3d-parameters.md`）。
 *
 * duration / easing / カメラ距離 / フェード時間をここ 1 箇所に集めるのは、細かい調整の
 * ために古いプロトタイプへ戻らずに済むようにするため（README の運用方針）。
 * **数値をシーンのコードへ直接書かないこと。**
 */

/** 遷移の所要時間（ms）。 */
export const DURATION = {
  /** 瓶へのパン。突っ込まず左へ寄せる。 */
  jarPan: 1250,
  /** 手帳の真上へ。傾きを 0 に戻すのも同じ長さで並走させる。 */
  journalTop: 560,
  /** 表紙が開く。 */
  coverOpen: 460,
  /** 見開きの中心へ寄る。 */
  spreadIn: 360,
  /** ボードへ正対する。 */
  boardFront: 900,
  /** SP だけ: 正対のあとさらに寄る。 */
  boardCloseSp: 860,
  /** SP だけ: 寄りと並走する瓶のフェードアウト。 */
  jarFadeSp: 620,
  /** 棚へパンする。 */
  shelfPan: 1000,
  /** 棚の背表紙が持ち上がる。 */
  spineLift: 420,
  /** 出ていくときに書斎を薄くする（遷移の後半に重ねる）。 */
  canvasFade: 600,
  /** 行き先の画面レイヤーのフェード。 */
  screenFade: 800,
} as const;

/**
 * 手帳を開く 3 段の重なり（0..1）。前の段がこの割合まで進んだら次を始める。
 *
 * 直列に並べると 950 + 760 + 620 ＝ **2.3 秒**かかり、実機レビューで「エントリーが
 * 開くのを待たされる、1 秒以内にしたい」と報告された。段を削ると振り付け
 * （寄る → 開く → 覗き込む）が壊れるので、**順序は保ったまま重ねる**。
 *
 * 人は「表紙が開き始める」のを、カメラが止まり切る前から読み取れる。止まるのを待つ
 * 必要があるのは機械の都合でしかない。
 */
export const JOURNAL_OVERLAP = {
  /** 真上へ寄るのがこの割合まで進んだら、表紙が開き始める。 */
  coverStartsAt: 0.55,
  /** 表紙がこの割合まで開いたら、見開きへ寄り始める。 */
  spreadStartsAt: 0.65,
} as const;

/**
 * 書斎から出ていくまでの上限（ms）。
 *
 * 「1 秒以内にエントリーが開ける体感」を数値にしたもの。段取りの合計がこれを超えたら、
 * それは待たされている。`transitions.test.ts` がこの上限を見張る。
 */
export const OPEN_BUDGET_MS = 1000;

/**
 * ホームで許す寄り引き（注視点からの距離の倍率。1 が配置表どおり）。
 *
 * カメラが 1 か所に釘付けで「閉塞感・束縛感がある」という実機レビューへの答え。
 * **周回はさせない。** 構図（机・瓶・板の位置関係）は設計の一部で、回せるようにすると
 * どの角度でも成立させるための作り込みが要る。近づく／離れるだけなら構図は保たれる。
 *
 * 上下限は狭く取る。引きすぎると部屋の外の何も無い空間が映り、寄りすぎると
 * 机の面だけになって行き先を見失う。
 */
export const HOME_ZOOM = {
  min: 0.72,
  max: 1.35,
  /** ホイールの delta 1 あたりの倍率変化。 */
  wheelStep: 0.0012,
  /** 目標へ寄せる速さ。指を離しても少し滑る。 */
  lerp: 0.12,
} as const;

/** 遷移の前に置く待ち（ms）。 */
export const DELAY = {
  /** SP のボード: 正対してから寄り始めるまで。 */
  boardCloseSp: 120,
} as const;

/** ページ束が表紙に遅れて開く比率（21-3d-parameters.md「ページの追従」）。 */
export const PAGE_FOLLOW = {
  /** 表紙の duration に対する 1 枚目の遅れ。 */
  leadDelayRatio: 0.24,
  /** 1 枚ごとに増える遅れ。 */
  perPageDelayRatio: 0.17,
  /** 表紙の duration に対する 1 枚の長さ。 */
  durationRatio: 0.82,
} as const;

/**
 * 遷移先へ寄るときのカメラ距離。PC と SP で式は同じで、距離だけ差し替える
 * （21-3d-parameters.md「遷移先のカメラ」）。
 */
export const VIEW_DISTANCE = {
  pc: { jar: 5.6, journal: 6.1, board: 4.5 },
  sp: { jar: 5.9, journal: 5.9, board: 11.3 },
} as const;

/** SP のボードは 2 段構え。正対したあとこの倍率まで寄る。 */
export const SP_BOARD_CLOSE_RATIO = 0.44;

/**
 * 真上から見るときに注視点から z をずらす量。
 *
 * 完全な真上は up ベクトルと平行になり `lookAt` が破綻する。
 */
export const TOP_VIEW_Z_NUDGE = 0.06;

/** 見開きへ寄るときの z のずらし量（真上より浅いので少し小さい）。 */
export const SPREAD_VIEW_Z_NUDGE = 0.04;

/**
 * ホームで漂う「呼吸」。
 *
 * **周期はおよそ 6.3 秒（2π 秒）で、1 秒ではない。** 原案は `sin(t) * 0.05`（t は秒）で、
 * これは角速度 1 rad/s ＝ 周期 2π 秒。`21-3d-parameters.md` の「（1s）」という注記は
 * 式の読み違いで、1 秒周期にすると画面全体が小刻みに上下し、見ていて酔う
 * （実機のレビューで「行きつ戻りつして気持ち悪い」と報告された）。
 */
export const BREATH = {
  /** 角速度（rad/s）。 */
  radiansPerSecond: 1,
  /** カメラ y の振幅。 */
  amplitude: 0.05,
} as const;

/**
 * イージング。すべて 0..1 → 0..1 の純関数。
 *
 * `21-3d-parameters.md` の表で名前を指す先がこれ。新しい曲線を足すときはここに足し、
 * シーン側でインラインの式を書かない。
 */
export const EASING = {
  linear: (p: number): number => p,
  /** `1-(1-p)³`。着地が緩やか。 */
  easeOutCubic: (p: number): number => 1 - (1 - p) ** 3,
  /** 立ち上がりと着地の両方が緩やか。 */
  easeInOutCubic: (p: number): number => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2),
} as const;

/** 0..1 に丸める。イージングへ渡す前に必ず通す。 */
export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/**
 * 経過時間から進捗（0..1）を出す。
 *
 * duration が 0 以下のときに NaN や Infinity を返さないこと
 * （`prefers-reduced-motion` で duration を 0 に落とす経路があり、そこで必ず 1 になる）。
 */
export function progress(elapsedMs: number, durationMs: number): number {
  if (durationMs <= 0) return 1;
  return clamp01(elapsedMs / durationMs);
}

/** 描画コストの上限（21-3d-parameters.md / 20-3d-component.md）。 */
export const RENDER_LIMITS = {
  /** ボードに貼るカードの最大枚数。zIndex 順に打ち切る。 */
  maxBoardCards: 30,
  /** devicePixelRatio の上限。 */
  maxPixelRatio: 2,
  /** 机に積む手帳の冊数（当月＋直近 2 ヶ月）。 */
  deskNotebooks: 3,
  /** 棚に並べる背表紙の本数。超えたら間隔を詰める。 */
  shelfSpines: 3,
} as const;
