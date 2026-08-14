'use client';

import { usePathname } from 'next/navigation';
import type { ReactElement } from 'react';
import { AccountRouteSkeleton } from './account-route-skeleton';
import { BoardRouteSkeleton } from './board-route-skeleton';
import { EntriesRouteSkeleton } from './entries-route-skeleton';
import { EntryEditorRouteSkeleton } from './entry-editor-route-skeleton';
import { JarRouteSkeleton } from './jar-route-skeleton';
import { QuestionsRouteSkeleton } from './questions-route-skeleton';

/**
 * パスから「その画面のスケルトン」を引く。
 *
 * なぜ必要か: 保護レイアウトは mount 前（SSR＋hydration）に children を描けない
 * （エディタ等の時刻/認証依存レンダリングが SSR↔client で食い違うため。Issue #362/#363）。
 * **ハードリロード時に最初に見える枠はこれ**で、`loading.tsx` は出番が無い（Suspense が
 * 挟まらないため）。つまりレイアウト側も行き先を知る必要がある。
 *
 * 各ルートの `loading.tsx` は同じ `*RouteSkeleton` を直接描く。マップの正はここ1か所で、
 * ルートの追加漏れは `test/architecture/route-skeletons.test.ts` が検出する。
 *
 * 未知のパスでは **null**（何も描かない）。間違った画面の枠を出すのは、
 * 何も出さないより悪い（今回の作り直しの発端がまさにそれ）。
 */
export function resolveRouteSkeleton(pathname: string): ReactElement | null {
  if (pathname === '/entries') return <EntriesRouteSkeleton />;
  if (pathname === '/entries/new') return <EntryEditorRouteSkeleton />;
  if (pathname.startsWith('/entries/')) return <EntryEditorRouteSkeleton existing />;
  if (pathname === '/jar') return <JarRouteSkeleton />;
  if (pathname === '/board') return <BoardRouteSkeleton />;
  if (pathname === '/questions') return <QuestionsRouteSkeleton />;
  if (pathname === '/account') return <AccountRouteSkeleton />;
  return null;
}

/** 現在のパスに対応するスケルトン（保護レイアウトの mount 前フォールバック）。 */
export function RouteSkeleton() {
  return resolveRouteSkeleton(usePathname());
}
