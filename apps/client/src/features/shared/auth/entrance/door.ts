/**
 * 扉をくぐるとき、**紙（フォーム）の側**が退く段取り。
 *
 * 扉そのもの・カメラの動きはここには無い。書斎のシーンが持っている
 * （`features/shared/study/scene/enter.ts` と `scene/entrance-room.ts`）— **扉は書斎の入口**で、
 * 認証画面と書斎は 1 つのシーンを見ているため。以前はここに扉だけの別シーンがあり、入るときに
 * 2 つの絵をクロスフェードしていた。それが「一回切り替わる」正体だった。
 *
 * 時刻を引数で受ける純関数だけを置く。rAF も three.js も知らないので、偽の時計でテストできる。
 */

/** 扉を開けて入る段取りの長さ（ms）。シーンの `ENTER_TIMING` と噛み合わせてある。 */
const ENTER_TIMING = {
  /** 扉が開き切るまで。 */
  doorMs: 700,
  /** 扉が開き始めてから歩き出すまで。開くのを待ち切らずに重ねる。 */
  walkDelayMs: 140,
  /**
   * 歩き出してから、**行き先へ移ってよくなる**まで。
   *
   * 歩きはここで終わらない（カメラは近づき続ける）。ここは「もう扉の正面まで来ているので、
   * 下で画面を入れ替えてよい」という時刻。
   */
  walkMs: 980,
  /**
   * 扉をくぐった先が**書斎ではない**ときの溶暗（ms）。
   *
   * 書斎へ向かうときは 0 — シーンをそのまま次の画面へ渡すので、隠すための溶暗が要らない
   * （`study/scene/live.ts`）。以前はどの行き先でも歩きの後半を地の色へ溶かしていて、
   * 「ホワイトアウトしてブツ切れになる」と報告された（PR #624 のレビュー）。
   * `/entries/new` のような行き先では景色が続けようが無いので、そこだけ溶暗で繋ぐ。
   */
  handoverMs: 360,
} as const;

export interface EnterPlan {
  doorMs: number;
  walkDelayMs: number;
  walkMs: number;
  /** 行き先へ渡すための溶暗を始める時刻。 */
  fadeStartMs: number;
  fadeMs: number;
  /** ここで行き先へ移ってよい。 */
  totalMs: number;
}

/**
 * `prefers-reduced-motion` のときは扉もカメラも動かさず、溶かすだけにする。
 *
 * 段を消すのではなく長さを 0 にする（`progress()` は duration 0 で必ず 1 を返す）。
 * 溶かす長さだけは残す — 0 にすると画面が切り替わるだけになり、何が起きたか分からない。
 */
const REDUCED_FADE_MS = 320;

/**
 * @param continuous 扉の前から行き先まで**カメラが 1 本で続く**か（＝行き先が書斎か）。
 *   続くなら溶暗は要らない。続かないなら、扉をくぐったところで溶かして繋ぐ。
 */
export function enterPlan(reducedMotion: boolean, continuous = true): EnterPlan {
  if (reducedMotion) {
    return {
      doorMs: 0,
      walkDelayMs: 0,
      walkMs: 0,
      fadeStartMs: 0,
      fadeMs: REDUCED_FADE_MS,
      totalMs: REDUCED_FADE_MS,
    };
  }
  const walkEnd = ENTER_TIMING.walkDelayMs + ENTER_TIMING.walkMs;
  const totalMs = Math.max(ENTER_TIMING.doorMs, walkEnd);
  const handoverMs = continuous ? 0 : ENTER_TIMING.handoverMs;
  const fadeStartMs = Math.max(0, totalMs - handoverMs);
  return {
    doorMs: ENTER_TIMING.doorMs,
    walkDelayMs: ENTER_TIMING.walkDelayMs,
    walkMs: ENTER_TIMING.walkMs,
    fadeStartMs,
    fadeMs: totalMs - fadeStartMs,
    totalMs,
  };
}
