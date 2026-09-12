'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { CONTROL_FONT, ELEVATED_CHIP_CLASS, ELEVATED_CHIP_STYLE } from '@/components/ui/surface';
import { useFermentationDetails } from '@/features/shared/fermentation/hooks/use-fermentation-details';
import { useFermentationForQuestion } from '@/features/shared/fermentation/hooks/use-fermentation-for-question';
import { useFermentationInbox } from '@/features/shared/fermentation/hooks/use-fermentation-inbox';
import type { JarQuestion } from '@/features/shared/questions/types';
import {
  SpElementSheet,
  type SpJarElement,
} from '@/features/sp/fermentation/components/sp-element-sheet';
import { type OrbitQuestion, SpJarOrbit } from '@/features/sp/fermentation/components/sp-jar-orbit';
import { SpJarOrbitSkeleton } from '@/features/sp/fermentation/components/sp-jar-skeleton';
import { SpQuestionZoom } from '@/features/sp/fermentation/components/sp-question-zoom';
import type { ApiClient } from '@/lib/api';
import { useUnread } from '@/lib/unread-context';

interface SpJarProps {
  api: ApiClient | null;
  /** 壜のまわりを回る問い。取得は page（use-jar-questions）が行う。 */
  questions: JarQuestion[];
  /** 問いがまだ取れていない間は「0 件」ではなく枠を出す。 */
  loading: boolean;
  /** 問いの追加・編集・終了を開く。一覧は page が重ねる（ドメインをまたぐため）。 */
  onManageQuestions: () => void;
}

/**
 * SP 版「瓶」。
 *
 * PC と同じ壜を中央に置き、そのまわりを問いの円が回る。指で払うと速く回り、
 * ひとつタップすると円が開いて、中の言葉・抜粋・手紙を読める。
 *
 * PC との違いは**盤面を持たないこと**。PC は問いの円を自分で好きな場所へ置ける
 * 世界だが、SP は片手で持つ画面なので「置き場」を作れない。代わりに軌道の上に
 * 等間隔で並べ、回して選ぶ。
 *
 * **画面に文字を置かない。** 見出し「瓶」は「書斎に戻る」の真下で 2 つ目のラベルに
 * 見え、「横に払うと回ります」は自走している円を見れば分かる、と報告された。
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

  // 円の中身は**開く前から**見せる。届いた手紙の詳細をまとめて引いておく
  // （問いは生存が最大 3 件なので往復も 3 回に収まる）。
  const fermentationIds = useMemo(() => letters.map((letter) => letter.fermentationId), [letters]);
  const { details } = useFermentationDetails(api, fermentationIds);

  const untitled = t('untitled');
  const orbitQuestions = useMemo<OrbitQuestion[]>(() => {
    const letterByQuestion = new Map(letters.map((letter) => [letter.questionId, letter]));
    return questions.map((question) => {
      const letter = letterByQuestion.get(question.id);
      const detail = letter ? details.get(letter.fermentationId) : undefined;
      return {
        id: question.id,
        text: question.currentText ?? untitled,
        hasLetter: letter !== undefined,
        unread: unreadReady && unreadQuestionIds.has(question.id),
        keywords: detail?.keywords.map((keyword) => keyword.keyword) ?? [],
        snippetCount: detail?.snippets.length ?? 0,
      };
    });
  }, [questions, letters, details, unreadReady, unreadQuestionIds, untitled]);

  return (
    <div
      className="relative flex h-full flex-col overflow-hidden bg-[var(--bg)] text-[var(--fg)]"
      {...verifyAttrs({
        unit: 'SpJar',
        loading,
        questionCount: orbitQuestions.length,
        open: openId !== null,
        element: element?.kind ?? 'none',
        unreadCount: orbitQuestions.filter((question) => question.unread).length,
      })}
    >
      {/* 取得中に「問いがありません」を出すと、一瞬「問いを消してしまった」ように見える。
          取れていない間は枠のまま待つ。 */}
      {loading ? (
        <SpJarOrbitSkeleton />
      ) : orbitQuestions.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-5 px-10 text-center">
          <p className="text-sm leading-relaxed opacity-60">{t('no_questions')}</p>
        </div>
      ) : (
        <SpJarOrbit questions={orbitQuestions} onSelect={setOpenId} />
      )}

      {/* 問いの管理へ。面はパレット・「書斎に戻る」と同じ（ELEVATED_CHIP）。 */}
      <div className="flex justify-center px-5 pb-6 pt-2">
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
