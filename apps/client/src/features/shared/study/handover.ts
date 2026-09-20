'use client';

/**
 * 画面が入れ替わるあいだ、部屋を**ルーターの上**に敷いておくための合図。
 *
 * 扉から書斎へ渡すとき、間に挟まるものが多い — 認証レイアウトが外れ、保護レイアウトが
 * mount し、そのレイアウトは mount 前にロード表示を出し、書斎の canvas は読み込みと
 * 最初の 1 フレームを待つ。**そのどれか 1 つでも地の色を描けば、そこが白く飛ぶ。**
 * 「まだホワイトアウト 2 回してブツ切れ感が強い」と報告された（PR #624 のレビュー）。
 *
 * 個々の段でフェードの時間を合わせても、段の数だけ穴が空く。ここでは**画面の上に 1 枚
 * 敷いたままにする**ことで穴そのものを無くす。敷く先はルーターの外（root layout の
 * `StudyHandover`）なので、どの画面が mount / unmount しても外れない。
 *
 * - 扉の側が、歩き終わりに敷く（`beginStudyHandoverFor`）
 * - 書斎の canvas が最初の 1 フレームを描いたら引く（`endStudyHandover`）
 * - 合図が来なくても、敷きっぱなしにはならない（`StudyHandover` の保険）
 *
 * 1 枚の絵そのものは `backdrop.ts` が持つ（戻り道と同じ 1 枚）。ここが持つのは
 * 「いま渡している最中か」だけ。
 */

import { readStudyBackdrop } from './backdrop';

/** フルページ遷移をまたぐための印。`sessionStorage` に時刻だけ置く。 */
const KEY = 'oryzae_study_handover';

/**
 * 印が効く長さ（ms）。
 *
 * 認証の完了はフルページ遷移で確定させる経路がある（OAuth・メール確認）。その読み込み
 * 直しをまたぐには `sessionStorage` に置くしかないが、**古い印で関係ない画面に絵を敷いて
 * しまわない**よう、短い時効を付ける。
 */
const FRESH_MS = 15_000;

/** 書斎のパス。ここへ向かうときだけ敷く。 */
const STUDY_PATH = '/';

let laid: string | null = null;
const listeners = new Set<() => void>();

/**
 * 行き先が書斎なら、最後の 1 枚を画面の上に敷く。
 *
 * 呼ぶのは**歩き切ってから、行き先へ移る前**。ここで敷いておけば、このあと何が
 * mount / unmount しても、見えているのは同じ部屋のままになる。
 */
export function beginStudyHandoverFor(destination: string, image: string | null): void {
  if (destination !== STUDY_PATH || image === null) return;
  laid = image;
  try {
    window.sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    // プライベートウィンドウ・容量超過。アプリ内遷移なら下の `laid` だけで足りる。
  }
  notify();
}

/** 書斎が描けた。引いてよい。 */
export function endStudyHandover(): void {
  laid = null;
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // 消せなくても時効で切れる。
  }
  notify();
}

/** いま敷いている 1 枚。無ければ null。 */
export function studyHandoverImage(): string | null {
  return laid;
}

/**
 * フルページ遷移のあとに、敷きかけの 1 枚を受け取る。**読んだら印は消す。**
 *
 * アプリ内遷移では `laid` がそのまま残るので、これを読むのは読み込み直しをまたいだ
 * ときだけになる。
 */
export function takePendingStudyHandover(): string | null {
  if (laid !== null) return laid;
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (raw === null) return null;
    window.sessionStorage.removeItem(KEY);
    const at = Number(raw);
    if (!Number.isFinite(at) || Date.now() - at > FRESH_MS) return null;
    laid = readStudyBackdrop();
    return laid;
  } catch {
    return null;
  }
}

/** 敷いた・引いたの変化を受け取る。 */
export function subscribeStudyHandover(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(): void {
  for (const listener of listeners) listener();
}
