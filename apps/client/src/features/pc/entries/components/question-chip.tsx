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
  const primary = linked[0];

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

  const primaryText = primary ? (primary.currentText ?? t('untitled')) : null;
  const label = primaryText ?? t('empty');
  const extraCount = linked.length - 1;

  return (
    // 器はボタンに張りつく大きさにする（inline-flex）。中央寄せの箱にしていた頃は、
    // 器がヘッダーの幅いっぱいに広がり、開いた面の左端がボタンの左端とずれていた。
    <div
      ref={rootRef}
      className="relative inline-flex max-w-full"
      {...verifyAttrs({
        unit: 'QuestionChip',
        open,
        linkedCount: linked.length,
        availableCount: activeQuestions.length,
        linked: linked.length > 0,
      })}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-7 max-w-[320px] items-center gap-1.5 rounded-full px-3 text-[13px] transition-colors"
        style={
          primary
            ? {
                color: 'var(--accent)',
                background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
                border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)',
              }
            : {
                color: 'var(--date-color)',
                border: '1px dashed var(--border-subtle)',
              }
        }
      >
        <span aria-hidden="true">{primary ? '◦' : '+'}</span>
        <span className="truncate">{label}</span>
        {extraCount > 0 && <span className="shrink-0 opacity-70">+{extraCount}</span>}
      </button>

      {open && (
        // 面の左端をボタンの左端に合わせる（left-0）。設定パネルの Select と同じ
        // MenuPanel / MenuOption を使うので、材質も行の高さも同じ。
        // ただし役割は違う: こちらは**結ぶ／解く**の付け外しなので menuitemcheckbox。
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
                  onClick={() => (linkedQuestionIds.has(q.id) ? onUnlink(q.id) : onLink(q.id))}
                >
                  {q.currentText ?? t('untitled')}
                </MenuOption>
              ))
            )}
          </MenuPanel>
        </div>
      )}
    </div>
  );
}
