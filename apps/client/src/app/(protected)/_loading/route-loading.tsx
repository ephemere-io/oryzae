'use client';

import { usePathname } from 'next/navigation';
import type { ReactElement } from 'react';
import { AccountRouteLoading } from './account-route-loading';
import { BoardRouteLoading } from './board-route-loading';
import { EntriesRouteLoading } from './entries-route-loading';
import { EntryEditorRouteLoading } from './entry-editor-route-loading';
import { JarRouteLoading } from './jar-route-loading';
import { QuestionsRouteLoading } from './questions-route-loading';
import { StudyRouteLoading } from './study-route-loading';

/**
 * パスから「その画面のロード表示」を引く。
 *
 * 出すものは画面次第で、判断基準は**レイアウトを予告できるか**の一点:
 *  - 行・カード・フォームが並ぶ画面（一覧 / 問い / アカウント / SP の瓶）→ スケルトン。
 *    実 DOM と同じ位置に枠を置けるので、データ到着時に何も動かない。
 *  - キャンバス（PC の瓶 / ボード）→ `PageLoading`。枠を置いても位置が当たらず予告に
 *    ならないため、素直に「読み込み中」を1つ出す。
 *
 * なぜレイアウト側にも必要か: 保護レイアウトは mount 前（SSR＋hydration）に children を
 * 描けない（エディタ等の時刻/認証依存レンダリングが SSR↔client で食い違うため。Issue #362/#363）。
 * **ハードリロード時に最初に見えるのはこれ**で、`loading.tsx` は出番が無い（Suspense が
 * 挟まらないため）。つまりレイアウト側も行き先を知る必要がある。
 *
 * 各ルートの `loading.tsx` は同じ `*RouteLoading` を直接描く。マップの正はここ1か所で、
 * ルートの追加漏れは `test/architecture/route-loading.test.ts` が検出する。
 *
 * 未知のパスでは **null**（何も描かない）。間違った画面の枠を出すのは、
 * 何も出さないより悪い。
 */
export function resolveRouteLoading(pathname: string): ReactElement | null {
  // ルート（/）は書斎。
  if (pathname === '/') return <StudyRouteLoading />;
  if (pathname === '/entries') return <EntriesRouteLoading />;
  if (pathname === '/entries/new') return <EntryEditorRouteLoading />;
  if (pathname.startsWith('/entries/')) return <EntryEditorRouteLoading existing />;
  if (pathname === '/jar') return <JarRouteLoading />;
  if (pathname === '/board') return <BoardRouteLoading />;
  if (pathname === '/questions') return <QuestionsRouteLoading />;
  if (pathname === '/account') return <AccountRouteLoading />;
  return null;
}

/** 現在のパスに対応するロード表示（保護レイアウトの mount 前フォールバック）。 */
export function RouteLoading() {
  return resolveRouteLoading(usePathname());
}
