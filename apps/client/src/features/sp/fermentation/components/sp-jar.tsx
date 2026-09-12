'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { CONTROL_FONT, ELEVATED_CHIP_CLASS, ELEVATED_CHIP_STYLE } from '@/components/ui/surface';
import { useFermentationForQuestion } from '@/features/shared/fermentation/hooks/use-fermentation-for-question';
import { useFermentationInbox } from '@/features/shared/fermentation/hooks/use-fermentation-inbox';
import type { JarQuestion } from '@/features/shared/questions/types';
import {
  SpElementSheet,
  type SpJarElement,
} from '@/features/sp/fermentation/components/sp-element-sheet';
import { type MapQuestion, SpJarMap } from '@/features/sp/fermentation/components/sp-jar-map';
import { SpJarMapSkeleton } from '@/features/sp/fermentation/components/sp-jar-skeleton';
import { SpQuestionZoom } from '@/features/sp/fermentation/components/sp-question-zoom';
import type { ApiClient } from '@/lib/api';
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
 * シャーレを押すと問いの画面（上に問いが 1 行、下に手紙・言葉・抜粋の一覧）へ移り、
 * 項目を押すと高さを変えられるセミモーダルで読む。
 *
 * 壜のまわりを円が自走で回る形は「回る必要性が分からない」と言われてやめた。
 * SP の違いは円の中に中身を並べないことだけで、構造は PC を踏襲する。
 *
 * **画面に文字を置かない。** 見出しや説明文は上段（SpTopBar）と地図が語る。
 * 残すのは問いの管理へ入るボタンだけ。
 */
export function SpJar({ api, questions, loading, onManageQuestions }: SpJarProps) {
  const t = useTranslations('sp.jar');
  const router = useRouter();
  const { letters } = useFermentationInbox(api, false);
  const { ready: unreadReady, unreadQuestionIds, markQuestionRead } = useUnread();

  const [openId, setOpenId] = useState<string | null>(null);
  const [element, setElement] = useState<SpJarElement | null>(null);

  const openQuestion = questions.find((question) => question.id === openId) ?? null;
  const { detail, loading: detailLoading } = useFermentationForQuestion(api, openQuestion?.id);

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
        element: element?.kind ?? 'none',
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
          <SpJarMap questions={mapQuestions} onSelect={setOpenId} />
        </div>
      )}

      {/* 問いの管理へ。面はパレット・上段の正円と同じ系統（ELEVATED_CHIP）。 */}
      <div className="flex shrink-0 justify-center px-5 pt-2 pb-6">
        <button
          type="button"
          onClick={onManageQuestions}
          className={`flex min-h-[44px] items-center px-6 text-[13px] font-medium tracking-[0.06em] ${ELEVATED_CHIP_CLASS}`}
          style={{ ...ELEVATED_CHIP_STYLE, ...CONTROL_FONT }}
        >
          {t('manage_questions')}
        </button>
      </div>

      {openQuestion ? (
        <SpQuestionZoom
          questionText={openQuestion.currentText ?? untitled}
          detail={detail}
          loading={detailLoading}
          onClose={() => {
            setOpenId(null);
            setElement(null);
          }}
          onOpenElement={(next) => {
            setElement(next);
            // Issue #447: 既読は「瓶を開いた時刻」ではなく「その手紙を開いたか」で決める。
            if (next.kind === 'letter') markQuestionRead(openQuestion.id);
          }}
        />
      ) : null}

      {element && openQuestion ? (
        <SpElementSheet
          element={element}
          onClose={() => setElement(null)}
          onReply={() => router.push(`/entries/new?questionId=${openQuestion.id}`)}
          onOpenSource={(entryId) => router.push(`/entries/${entryId}`)}
        />
      ) : null}
    </div>
  );
}
