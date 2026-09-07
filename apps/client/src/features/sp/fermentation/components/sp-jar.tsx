'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFermentationDetails } from '@/features/shared/fermentation/hooks/use-fermentation-details';
import { useFermentationForQuestion } from '@/features/shared/fermentation/hooks/use-fermentation-for-question';
import { useFermentationInbox } from '@/features/shared/fermentation/hooks/use-fermentation-inbox';
import { useJarLayoutSave } from '@/features/shared/fermentation/hooks/use-jar-layout-save';
import type { FermentationDetail, JarLayout } from '@/features/shared/fermentation/types';
import type { JarQuestion } from '@/features/shared/questions/types';
import {
  SpElementSheet,
  type SpJarElement,
} from '@/features/sp/fermentation/components/sp-element-sheet';
import { type OrbitQuestion, SpJarOrbit } from '@/features/sp/fermentation/components/sp-jar-orbit';
import { SpJarOrbitSkeleton } from '@/features/sp/fermentation/components/sp-jar-skeleton';
import {
  SpQuestionZoom,
  type ZoomPosition,
} from '@/features/sp/fermentation/components/sp-question-zoom';
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
  /**
   * 開いた状態で入りたい手紙の発酵 id（`/jar?letter=`）。
   *
   * 書斎の瓶の上の封を押すとここへ来る。「届いた」ことを 3D で見せておいて、
   * 押した先で改めて探させるのでは、封を出した意味が無い。
   */
  openLetterFor?: string | null;
}

/**
 * SP 版「瓶」。
 *
 * PC と同じ壜を中央に置き、そのまわりを問いの円が回る。指で払うと速く回り、
 * ひとつタップすると円が画面いっぱいに開いて、中の言葉・抜粋・手紙を読める。
 *
 * PC との違いは**盤面を持たないこと**。PC は問いの円を自分で好きな場所へ置ける
 * 世界だが、SP は片手で持つ画面なので「置き場」を作れない。代わりに軌道の上に
 * 等間隔で並べ、回して選ぶ。
 */
export function SpJar({
  api,
  questions,
  loading,
  onManageQuestions,
  openLetterFor = null,
}: SpJarProps) {
  const t = useTranslations('sp.jar');
  const router = useRouter();
  const { letters } = useFermentationInbox(api, false);
  const { ready: unreadReady, unreadQuestionIds, markQuestionRead } = useUnread();

  const [openId, setOpenId] = useState<string | null>(null);
  const [element, setElement] = useState<SpJarElement | null>(null);
  /**
   * 書斎の封から渡された「開いて入りたい手紙」。
   *
   * 一度開いたら消す。残したままだと、利用者が閉じた瞬間に効果が再び効いて開き直る。
   */
  const [pendingLetter, setPendingLetter] = useState<string | null>(openLetterFor);

  /**
   * 円の中で動かした要素の位置（id → 位置）。
   *
   * サーバーにも憶える（PC の瓶と同じ `PUT /api/v1/jar/layout`）。置いた場所が端末を
   * またいで残らないと、動かせる意味が薄い。保存は 500ms まとめ（useJarLayoutSave）。
   */
  const [positions, setPositions] = useState<Record<string, ZoomPosition>>({});
  const { saveLayout } = useJarLayoutSave(api);

  const openQuestion = questions.find((question) => question.id === openId) ?? null;
  const { detail, loading: detailLoading } = useFermentationForQuestion(api, openQuestion?.id);

  // サーバーが憶えている位置を初期値にする。動かしていない要素は輪の上の既定位置。
  const storedPositions = useMemo<Record<string, ZoomPosition>>(() => {
    if (!detail) return {};
    const out: Record<string, ZoomPosition> = {};
    const put = (item: { id: string; jarX: number | null; jarY: number | null }) => {
      if (item.jarX === null || item.jarY === null) return;
      out[item.id] = { xPercent: item.jarX, yPercent: item.jarY };
    };
    for (const keyword of detail.keywords) put(keyword);
    for (const snippet of detail.snippets) put(snippet);
    if (detail.letter) put(detail.letter);
    return out;
  }, [detail]);

  const handleMove = useCallback(
    (id: string, position: ZoomPosition) => {
      setPositions((prev) => {
        const next = { ...prev, [id]: position };
        if (detail) saveLayout(toJarLayout(detail, { ...storedPositions, ...next }));
        return next;
      });
    },
    [detail, storedPositions, saveLayout],
  );

  // 円の中身は**開く前から**見せる。届いた手紙の詳細をまとめて引いておく
  // （問いは生存が最大 3 件なので往復も 3 回に収まる）。
  const fermentationIds = useMemo(() => letters.map((letter) => letter.fermentationId), [letters]);
  const { details } = useFermentationDetails(api, fermentationIds);

  /**
   * 書斎の封から来たとき、その手紙を持つ問いの円を開く。
   *
   * URL が持っているのは**発酵の id** で、円は問いで並んでいる。両方を知っているのは
   * 受信箱なので、そこで引き直す（受信箱が届くまでは何もしない）。
   */
  useEffect(() => {
    if (pendingLetter === null) return;
    const letter = letters.find((candidate) => candidate.fermentationId === pendingLetter);
    if (!letter) return;
    setOpenId(letter.questionId);
  }, [pendingLetter, letters]);

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
      style={{ fontFamily: 'var(--ob-font-serif)' }}
      {...verifyAttrs({
        unit: 'SpJar',
        loading,
        questionCount: orbitQuestions.length,
        open: openId !== null,
        element: element?.kind ?? 'none',
        unreadCount: orbitQuestions.filter((question) => question.unread).length,
      })}
    >
      {/* 左上は「書斎へ戻る」マークの席なので、見出しは中央に置く
          （左寄せだとマークの下に潜って読めない）。 */}
      <header className="px-5 pt-6 pb-2 text-center text-lg font-medium">{t('title')}</header>

      {/* 取得中に「問いがありません」を出すと、一瞬「問いを消してしまった」ように見える。
          取れていない間は枠のまま待つ。 */}
      {loading ? (
        <SpJarOrbitSkeleton />
      ) : orbitQuestions.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-5 px-10 text-center">
          <p className="text-sm leading-relaxed opacity-60">{t('no_questions')}</p>
        </div>
      ) : (
        <>
          <SpJarOrbit questions={orbitQuestions} onSelect={setOpenId} />
          <p
            className="pb-1 text-center text-[11px]"
            style={{ color: 'var(--date-color)', fontFamily: 'var(--ob-font-sans)' }}
          >
            {t('spin_hint')}
          </p>
        </>
      )}

      <div className="flex justify-center px-5 pb-7 pt-2">
        <button
          type="button"
          onClick={onManageQuestions}
          className="rounded-full px-6 py-3 text-sm"
          style={{
            background: 'var(--ob-card-bg)',
            border: '1px solid var(--border-subtle)',
            fontFamily: 'var(--ob-font-sans)',
          }}
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
          positions={{ ...storedPositions, ...positions }}
          onMove={handleMove}
          autoOpenLetter={pendingLetter !== null}
          onOpenElement={(next) => {
            setElement(next);
            // 開いたら合図を消す。残したままだと、閉じた瞬間に開き直る。
            setPendingLetter(null);
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

/**
 * 動かした位置を保存の形に直す。
 *
 * サーバーは種類ごとの配列（keywords / snippets / letters）で受ける。ここに載せるのは
 * **位置が決まっているものだけ**（まだ動かしていない要素は既定の輪の上に居るので、
 * 座標を持たせない＝次に開いたときも輪の上から始まる）。
 */
function toJarLayout(
  detail: FermentationDetail,
  positions: Record<string, ZoomPosition>,
): JarLayout {
  const pick = (items: readonly { id: string }[]) =>
    items.flatMap((item) => {
      const position = positions[item.id];
      if (!position) return [];
      return [{ id: item.id, jarX: position.xPercent, jarY: position.yPercent }];
    });

  return {
    questions: [],
    keywords: pick(detail.keywords),
    snippets: pick(detail.snippets),
    letters: pick(detail.letter ? [detail.letter] : []),
  };
}
