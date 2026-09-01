'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { MenuOption, MenuPanel } from '@/components/ui/menu';

interface QuestionOption {
  id: string;
  currentText: string | null;
}

interface QuestionChipProps {
  activeQuestions: QuestionOption[];
  linkedQuestionIds: Set<string>;
  onLink: (questionId: string) => void;
  onUnlink: (questionId: string) => void;
  /**
   * 開閉を外から制御する（省略時は自分で持つ）。
   * アクションパレットの「問いを結ぶ」からも同じドロップダウンを開けるようにするため。
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * トップバー中央（日付・タイトルの直下）に置く問いチップ。
 *
 * Issue #228: 専用の「問いを紐づける」行を削り、エントリーの身元（日付・タイトル・問い）を
 * 中央の1カラムに集約する。Issue #365: select + ＋ボタン + チップ列という3部品の並びを、
 * 「いま結ばれている問い」を出す1つのチップ + ドロップダウンに畳む。
 *
 * **選ぶのは1つ。** このエントリーは「この問いへの答え」であって、複数の問いへの
 * 同時の答えではない。別の問いを選べば結び直し、同じ問いをもう一度選べば解ける。
 * 役割は設定パネルの Select と同じ（listbox / option）——同じ「選ぶ」なので同じ形にする。
 *
 * 既に複数結ばれている記録（単一選択にする前のもの）は、そのまま「+n」で見せる。
 * 隠すと、本人が結んだはずの問いが黙って消えたように見える。
 *
 * docs/entry-screen-design.md §3「トップバーの再編」/ 原則3。
 */
export function QuestionChip({
  activeQuestions,
  linkedQuestionIds,
  onLink,
  onUnlink,
  open: controlledOpen,
  onOpenChange,
}: QuestionChipProps) {
  const t = useTranslations('entries.question_chip');
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = useCallback(
    (next: boolean) => {
      if (onOpenChange) onOpenChange(next);
      else setUncontrolledOpen(next);
    },
    [onOpenChange],
  );
  const rootRef = useRef<HTMLDivElement>(null);

  const linked = activeQuestions.filter((q) => linkedQuestionIds.has(q.id));

  /** 付け外し。押すたびに結び／解く（面は開いたままにする——続けて選べるように）。 */
  const toggleLink = useCallback(
    (questionId: string) => {
      if (linkedQuestionIds.has(questionId)) onUnlink(questionId);
      else onLink(questionId);
    },
    [linkedQuestionIds, onLink, onUnlink],
  );

  // 外側クリック / Escape で閉じる。ドロップダウンは中央に開くので、
  // 本文をクリックして書き始めた瞬間に消えてほしい。
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: PointerEvent) {
      const root = rootRef.current;
      if (!root) return;
      if (e.target instanceof Node && !root.contains(e.target)) setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, setOpen]);

  // CSS カスタムプロパティは React.CSSProperties に含まれないので、`--*` を許す形で広げる。
  const linkedChipStyle: React.CSSProperties & Record<`--${string}`, string> = {
    color: 'var(--accent)',
    '--chip-bg': 'color-mix(in srgb, var(--accent) 14%, var(--surface-raised))',
    '--chip-bg-hover': 'color-mix(in srgb, var(--accent) 24%, var(--surface-raised))',
    '--chip-border': 'color-mix(in srgb, var(--accent) 38%, transparent)',
    '--chip-border-hover': 'color-mix(in srgb, var(--accent) 60%, transparent)',
  };
  const addChipStyle: React.CSSProperties & Record<`--${string}`, string> = {
    color: 'var(--fg)',
    '--chip-bg': 'var(--surface-raised)',
    '--chip-bg-hover': 'color-mix(in srgb, var(--accent) 12%, var(--surface-raised))',
    '--chip-border': 'var(--surface-raised-border)',
    '--chip-border-hover': 'color-mix(in srgb, var(--accent) 45%, transparent)',
  };
  const chipClass =
    'flex h-8 shrink-0 items-center gap-2 rounded-full border border-[var(--chip-border)] ' +
    'bg-[var(--chip-bg)] px-3.5 text-[13.5px] font-medium transition-colors duration-150 ' +
    'hover:border-[var(--chip-border-hover)] hover:bg-[var(--chip-bg-hover)]';

  return (
    // 器はボタンに張りつく大きさにする（inline-flex）。中央寄せの箱にしていた頃は、
    // 器がヘッダーの幅いっぱいに広がり、開いた面の左端がボタンの左端とずれていた。
    <div
      ref={rootRef}
      className="flex min-w-0 items-center gap-1.5"
      {...verifyAttrs({
        unit: 'QuestionChip',
        open,
        linkedCount: linked.length,
        availableCount: activeQuestions.length,
        linked: linked.length > 0,
      })}
    >
      {/* 結ばれている問いは**全部並べる**。以前は先頭だけを出して残りを「+n」に畳んでいたが、
          畳んだ数字からは「どの問いを結んだのか」が分からない。横に余裕がある場所なので、
          そのまま並べ、あふれたら横に流す（縦に折り返すとヘッダーの高さが動く）。 */}
      <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {linked.map((q) => (
          <button
            key={q.id}
            type="button"
            onClick={() => onUnlink(q.id)}
            aria-label={t('unlink_aria', { text: q.currentText ?? t('untitled') })}
            className={chipClass}
            style={linkedChipStyle}
          >
            <span aria-hidden="true">◦</span>
            <span className="whitespace-nowrap">{q.currentText ?? t('untitled')}</span>
            <span aria-hidden="true" className="text-[11px] opacity-55">
              ×
            </span>
          </button>
        ))}
      </div>

      {/* 足す。**行の外**に置く——行は横に流れる（overflow）ので、中に置くと
          開いた面がその枠で切られてしまう。 */}
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={t('empty')}
          className={chipClass}
          style={addChipStyle}
        >
          <span aria-hidden="true">+</span>
          {linked.length === 0 && <span className="whitespace-nowrap">{t('empty')}</span>}
        </button>

        {open && (
          // 面の左端を「足す」チップの左端に合わせる（left-0）。
          // 設定パネルの Select と同じ MenuPanel / MenuOption で開く。
          <div className="absolute top-full left-0 z-[62] mt-2 w-[320px]">
            <MenuPanel role="menu" ariaLabel={t('empty')} className="max-h-[50vh]">
              {activeQuestions.length === 0 ? (
                <p className="px-3 py-2 text-[13px] text-[var(--date-color)]">
                  {t('none_available')}
                </p>
              ) : (
                activeQuestions.map((q) => (
                  <MenuOption
                    key={q.id}
                    role="menuitemcheckbox"
                    selected={linkedQuestionIds.has(q.id)}
                    onClick={() => toggleLink(q.id)}
                  >
                    {q.currentText ?? t('untitled')}
                  </MenuOption>
                ))
              )}
            </MenuPanel>
          </div>
        )}
      </div>
    </div>
  );
}
