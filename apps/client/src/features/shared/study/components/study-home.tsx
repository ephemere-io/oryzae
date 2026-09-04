'use client';

// verify-exempt: router / データ取得 / three.js の dynamic import を束ねるページ級の合成。
// 中身の部品（StudyChrome / EntryListOverlay / StudyFallback）が個別に検証されている。

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import { useStudyState } from '../hooks/use-study-state';
import type { StudyLayout } from '../layout';
import { overlayScope, targetHref } from '../navigation';
import type { StudyEntry, StudyTarget } from '../types';
import { EntryListOverlay } from './entry-list-overlay';
import { StudyChrome } from './study-chrome';
import { StudyFallback } from './study-fallback';

/**
 * three.js は初期バンドルに載せない（`/jar` を直接開いた人に 600KB を配らない）。
 * `ssr: false` は Client Component の中でしか効かないので、ここで指定する。
 */
const StudyCanvas = dynamic(() => import('./study-canvas').then((module) => module.StudyCanvas), {
  ssr: false,
  loading: () => <StudyFallback loading />,
});

export interface StudyHomeProps {
  /**
   * 構図。端末との対応づけは `features/pc/study` と `features/sp/study` が持つ。
   * ここでは端末を判定しない（features/shared の規約）。
   */
  layout: StudyLayout;
  /** 下端のキャプションを出すか。SP はボトムナビと競合するので出さない。 */
  showCaption?: boolean;
}

export function StudyHome({ layout, showCaption = true }: StudyHomeProps) {
  const router = useRouter();
  const { api, auth, loading: authLoading } = useAuth();
  const { theme } = useTheme();
  const { state } = useStudyState(api, authLoading);

  // 一覧オーバーレイは書斎の中で開く（URL は変わらない）。
  const [overlay, setOverlay] = useState<{ month: string | null } | null>(null);

  const months = useMemo(
    () => state.notebooks.map((notebook) => notebook.month),
    [state.notebooks],
  );

  const handleNavigate = useCallback(
    (target: StudyTarget) => {
      const href = targetHref(target);
      // カメラが着いてから URL を変える。クロスフェードの間に遷移する。
      if (href !== null) router.push(href);
    },
    [router],
  );

  const handleOpenOverlay = useCallback((target: StudyTarget) => {
    setOverlay(overlayScope(target));
  }, []);

  const handleSelectEntry = useCallback(
    (entry: StudyEntry) => {
      setOverlay(null);
      router.push(`/entries/${entry.id}`);
    },
    [router],
  );

  return (
    <div className="absolute inset-0 overflow-hidden">
      <StudyCanvas
        state={state}
        layout={layout}
        theme={theme}
        onNavigate={handleNavigate}
        onOpenOverlay={handleOpenOverlay}
      />

      <StudyChrome
        status={state.fermentation.status}
        readiness={state.fermentation.readiness}
        initial={initialOf(auth?.user.nickname, auth?.user.email)}
        avatarUrl={auth?.user.avatarUrl}
        showCaption={showCaption && overlay === null}
      />

      <EntryListOverlay
        open={overlay !== null}
        entries={state.entries}
        months={months}
        selectedMonth={overlay?.month ?? null}
        onSelectMonth={(month) => setOverlay({ month })}
        onSelectEntry={handleSelectEntry}
        onClose={() => setOverlay(null)}
      />
    </div>
  );
}

/** アバターに出す 1 文字。 */
function initialOf(nickname?: string | null, email?: string | null): string {
  return (nickname?.charAt(0) ?? email?.charAt(0) ?? '?').toUpperCase();
}
