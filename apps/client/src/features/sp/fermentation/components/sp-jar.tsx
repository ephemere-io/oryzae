'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { ActionPalette } from '@/components/ui/action-palette';
import { PlusIcon } from '@/components/ui/palette-icons';
import { useFermentationDetails } from '@/features/shared/fermentation/hooks/use-fermentation-details';
import { useFermentationHistory } from '@/features/shared/fermentation/hooks/use-fermentation-history';
import { useFermentationInbox } from '@/features/shared/fermentation/hooks/use-fermentation-inbox';
import { useJarLayoutSave } from '@/features/shared/fermentation/hooks/use-jar-layout-save';
import type { JarQuestion } from '@/features/shared/questions/types';
import { type MapQuestion, SpJarMap } from '@/features/sp/fermentation/components/sp-jar-map';
import { SpJarMapSkeleton } from '@/features/sp/fermentation/components/sp-jar-skeleton';
import { SpQuestionZoom } from '@/features/sp/fermentation/components/sp-question-zoom';
import type { ApiClient } from '@/lib/api';
import { placeInSlot, useSpChrome } from '@/lib/sp-chrome-context';
import { useUnread } from '@/lib/unread-context';

interface SpJarProps {
  api: ApiClient | null;
  /** 地図に置く問い。取得は page（use-jar-questions）が行う。 */
  questions: JarQuestion[];
  /** 問いがまだ取れていない間は「0 件」ではなく枠を出す。 */
  loading: boolean;
  /** 問いの追加・編集・終了を開く。一覧は page が重ねる（ドメインをまたぐため）。 */
  onManageQuestions: () => void;
}

/**
 * SP 版「瓶」。
 *
 * **PC と同じ 2D の地図**（中央に壜、まわりにシャーレ）を指で寄り引きして見る。
 * シャーレを押すと問いの画面（上に問いが 1 行、下に手紙・キーワード・スニペットを読む流れ）へ移る。
 *
 * 壜のまわりを円が自走で回る形は「回る必要性が分からない」と言われてやめた。
 * SP の違いは円の中に中身を並べないことだけで、構造は PC を踏襲する。
 *
 * **画面に文字を置かない。** 見出しや説明文は上段（SpTopBar）と地図が語る。
 * 問いの管理へ入る口は右下の正円（地図アプリの定位置）。
 */
export function SpJar({ api, questions, loading, onManageQuestions }: SpJarProps) {
  const t = useTranslations('sp.jar');
  const chrome = useSpChrome();
  const router = useRouter();
  const { letters } = useFermentationInbox(api, false);
  const { saveLayout } = useJarLayoutSave(api);
  const { ready: unreadReady, unreadQuestionIds, markQuestionRead } = useUnread();

  const [openId, setOpenId] = useState<string | null>(null);

  const openQuestion = questions.find((question) => question.id === openId) ?? null;

  /**
   * 問いごとの最新の手紙（完了した発酵）。受信箱（`letters`）から引く。
   *
   * **地図を開いた時点で中身を先読みする。** 以前は円を押してから「一覧 → 詳細」と 2 往復して
   * いて、問いの画面が長く空だった（実機レビュー）。手紙の id は受信箱にあるので、詳細だけを
   * まとめて取っておけば、押した瞬間に出る。取り直しは無い（`useFermentationDetails` が覚える）。
   */
  const latestLetterByQuestion = useMemo(() => {
    const latest = new Map<string, { fermentationId: string; createdAt: string }>();
    for (const letter of letters) {
      const current = latest.get(letter.questionId);
      if (!current || letter.createdAt > current.createdAt) {
        latest.set(letter.questionId, {
          fermentationId: letter.fermentationId,
          createdAt: letter.createdAt,
        });
      }
    }
    return latest;
  }, [letters]);
  /**
   * 問いごとの、これまでの発酵（新しい順）。PC の履歴（cover flow）の SP 版で、問いの画面の
   * 上に日付の帯として並べ、押せばその回の手紙・言葉・抜粋に切り替わる。
   */
  const { byQuestion: historyByQuestion } = useFermentationHistory(api, false);
  /** 履歴で選んだ回。null なら最新。問いを変えれば最新に戻る。 */
  const [historyPick, setHistoryPick] = useState<string | null>(null);
  const openHistory = useMemo(
    () =>
      openQuestion
        ? [...(historyByQuestion.get(openQuestion.id) ?? [])]
            .reverse()
            .map((summary) => ({ fermentationId: summary.id, createdAt: summary.createdAt }))
        : [],
    [openQuestion, historyByQuestion],
  );
  // 先読みは最新の手紙。開いている問いはこれまでの回も取っておく（帯を押した瞬間に出る）。
  const letterIds = useMemo(() => {
    const ids = [...latestLetterByQuestion.values()].map((entry) => entry.fermentationId);
    for (const item of openHistory) {
      if (!ids.includes(item.fermentationId)) ids.push(item.fermentationId);
    }
    return ids;
  }, [latestLetterByQuestion, openHistory]);
  const { details, loading: detailsLoading } = useFermentationDetails(api, letterIds);
  const latestFermentationId = openQuestion
    ? (latestLetterByQuestion.get(openQuestion.id)?.fermentationId ?? null)
    : null;
  const openFermentationId =
    historyPick && openHistory.some((item) => item.fermentationId === historyPick)
      ? historyPick
      : latestFermentationId;
  const detail = openFermentationId ? (details.get(openFermentationId) ?? null) : null;
  const detailLoading =
    openFermentationId !== null && !details.has(openFermentationId) && detailsLoading;
  // Issue #447: 既読は「その手紙を開いたか」。手紙は問いの画面に最初から出るので、最新の手紙が
  // 画面に出た時点で読んだことにする。
  useEffect(() => {
    if (!openQuestion || !detail?.letter) return;
    if (openFermentationId !== latestFermentationId) return;
    markQuestionRead(openQuestion.id);
  }, [openQuestion, detail, openFermentationId, latestFermentationId, markQuestionRead]);

  const untitled = t('untitled');
  const mapQuestions = useMemo<MapQuestion[]>(() => {
    const letterByQuestion = new Set(letters.map((letter) => letter.questionId));
    return questions.map((question) => ({
      id: question.id,
      text: question.currentText ?? untitled,
      jarX: question.jarX,
      jarY: question.jarY,
      hasLetter: letterByQuestion.has(question.id),
      unread: unreadReady && unreadQuestionIds.has(question.id),
    }));
  }, [questions, letters, unreadReady, unreadQuestionIds, untitled]);

  return (
    <div
      className="relative flex h-full flex-col overflow-hidden bg-[var(--bg)] text-[var(--fg)]"
      {...verifyAttrs({
        unit: 'SpJar',
        loading,
        questionCount: mapQuestions.length,
        open: openId !== null,
        unreadCount: mapQuestions.filter((question) => question.unread).length,
      })}
    >
      {/* 取得中に「問いがありません」を出すと、一瞬「問いを消してしまった」ように見える。
          取れていない間は枠のまま待つ。 */}
      {loading ? (
        <SpJarMapSkeleton />
      ) : mapQuestions.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-5 px-10 text-center">
          <p className="text-sm leading-relaxed opacity-60">{t('no_questions')}</p>
        </div>
      ) : (
        <div className="relative min-h-0 flex-1">
          <SpJarMap
            questions={mapQuestions}
            onSelect={(id) => {
              setOpenId(id);
              setHistoryPick(null);
            }}
            // 置き直した円は PC と同じ API で保存する（動かした 1 つだけを送る。サーバーは項目ごとに更新）。
            onMove={(id, position) =>
              saveLayout({
                questions: [{ id, jarX: position.jarX, jarY: position.jarY }],
                keywords: [],
                snippets: [],
                letters: [],
              })
            }
          />
        </div>
      )}

      {/* 問いの管理へ。殻の下端の列（エントリー・ボードと同じ部品）に置く。
          以前は右下の正円だったが、3 画面で同じ部品にする（オーナーの指示）。 */}
      {!openQuestion &&
        placeInSlot(
          <ActionPalette
            ariaLabel={t('palette_aria')}
            actions={[
              {
                id: 'questions',
                label: t('manage_questions'),
                icon: <PlusIcon />,
                onSelect: onManageQuestions,
              },
            ]}
          />,
          chrome.paletteSlot,
        )}

      {openQuestion ? (
        <SpQuestionZoom
          questionText={openQuestion.currentText ?? untitled}
          detail={detail}
          loading={detailLoading}
          history={openHistory}
          selectedFermentationId={openFermentationId}
          onSelectFermentation={setHistoryPick}
          onReply={() => router.push(`/entries/new?questionId=${openQuestion.id}`)}
          onOpenSource={(entryId) => router.push(`/entries/${entryId}`)}
          onClose={() => setOpenId(null)}
        />
      ) : null}
    </div>
  );
}
