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

  // CSS カスタムプロパティは React.CSSProperties に含まれないので、`--*` を許す形で広げる。
  const chipStyle: React.CSSProperties & Record<`--${string}`, string> = primary
    ? {
        color: 'var(--accent)',
        '--chip-bg': 'color-mix(in srgb, var(--accent) 14%, var(--surface-raised))',
        '--chip-bg-hover': 'color-mix(in srgb, var(--accent) 24%, var(--surface-raised))',
        '--chip-border': 'color-mix(in srgb, var(--accent) 38%, transparent)',
        '--chip-border-hover': 'color-mix(in srgb, var(--accent) 60%, transparent)',
      }
    : {
        color: 'var(--fg)',
        '--chip-bg': 'var(--surface-raised)',
        '--chip-bg-hover': 'color-mix(in srgb, var(--accent) 12%, var(--surface-raised))',
        '--chip-border': 'var(--surface-raised-border)',
        '--chip-border-hover': 'color-mix(in srgb, var(--accent) 45%, transparent)',
      };

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
      {/* 複数結ばれていることは見た目の「+n」で出すが、読み上げには数が届かないので
          そのときだけ aria-label で件数を言う。 */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={linked.length > 1 ? t('linked_count', { count: linked.length }) : undefined}
        // ヘッダーで唯一の「押せるもの」であり、この画面でいちばん大事な選択なので、
        // 日付や歯車より一段強く出す（高さ・字の大きさ・地の濃さを上げる）。
        // 結ばれていないときも、点線の枠だけの弱い印にはしない——結ぶ操作に気づかれないと、
        // エントリーは問いに結ばれないまま溜まっていく。
        // 色は CSS 変数で渡し、地の切り替えは class（`hover:`）に任せる。
        // インラインの background を直接置くと :hover に必ず勝ってしまい、
        // 触っても何も変わらないボタンになる（そうなっていた）。
        // 結ばれていないときの地は**黒の洗いではなく白い面**にする。紙の上に黒を敷くと、
        // 沈んで汚れて見える。
        className="flex h-8 max-w-[340px] items-center gap-2 rounded-full border border-[var(--chip-border)] bg-[var(--chip-bg)] px-3.5 text-[13.5px] font-medium transition-colors duration-150 hover:border-[var(--chip-border-hover)] hover:bg-[var(--chip-bg-hover)]"
        style={chipStyle}
      >
        <span aria-hidden="true">{primary ? '◦' : '+'}</span>
        <span className="truncate">{label}</span>
        {/* 2つ目以降。薄い「+1」では複数結ばれていることが読み取れなかったので、
            チップの中にもう1枚の丸をはっきり置く（数はここでしか出ない情報）。 */}
        {extraCount > 0 && (
          <span
            className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full px-1 text-[11px] leading-none font-medium"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--accent) 22%, transparent)',
              color: 'var(--accent)',
            }}
          >
            +{extraCount}
          </span>
        )}
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
