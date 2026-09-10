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

/** 列のどちらの端にまだ続きがあるか。 */
interface RailEdges {
  start: boolean;
  end: boolean;
}

const NO_EDGES: RailEdges = { start: false, end: false };

/** 霞ませる幅（px）。チップ 1 枚の頭が読める程度に留める。 */
const RAIL_FADE_PX = 24;

function readRailEdges(rail: HTMLElement): RailEdges {
  // 1px の誤差を見込む（小数の scrollLeft で端に着いても着かないことがある）。
  return {
    start: rail.scrollLeft > 1,
    end: rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 1,
  };
}

/** あふれている側の端だけを霞ませる。どちらも収まっていれば何もしない。 */
function railMaskStyle(edges: RailEdges): React.CSSProperties | undefined {
  if (!edges.start && !edges.end) return undefined;
  const start = edges.start ? `transparent 0, #000 ${RAIL_FADE_PX}px` : '#000 0';
  const end = edges.end ? `#000 calc(100% - ${RAIL_FADE_PX}px), transparent 100%` : '#000 100%';
  const mask = `linear-gradient(to right, ${start}, ${end})`;
  return { maskImage: mask, WebkitMaskImage: mask };
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
  const railRef = useRef<HTMLDivElement>(null);

  const linked = activeQuestions.filter((q) => linkedQuestionIds.has(q.id));

  /**
   * 結んだ問いの列は**決まった幅の中で横に流れる**。
   *
   * 以前は列が伸び放題で、問いを 2 つ結ぶと画面の中央まで届き、上端に掛かる
   * 「書斎へ戻る」と重なった（実機レビュー）。行を下へずらす直し方は「ただ
   * ずらしただけ」と言われたので、列の側を決まった幅に収め、その中で流す。
   *
   * 流れていることが見えないと、隠れた問いが「無い」ことになる。**あふれている側の
   * 端だけを霞ませ**、そこにまだ続きがあると見せる。縦のホイールも横に回す
   * （マウスには横のホイールが無い）。
   */
  const [edges, setEdges] = useState<RailEdges>(NO_EDGES);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const update = () => setEdges(readRailEdges(rail));
    update();
    rail.addEventListener('scroll', update, { passive: true });
    // 幅が変わったら測り直す。ResizeObserver が無い環境（jsdom）では、スクロールと
    // 結び直しのときだけ測る — 霞みが遅れて付くだけで、列は流れる。
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(rail);

    const onWheel = (event: WheelEvent) => {
      // トラックパッドの横スワイプはそのまま通す。縦しか持たないホイールだけを横へ。
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      if (rail.scrollWidth <= rail.clientWidth) return;
      event.preventDefault();
      rail.scrollLeft += event.deltaY;
    };
    rail.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      rail.removeEventListener('scroll', update);
      rail.removeEventListener('wheel', onWheel);
      observer?.disconnect();
    };
  }, []);

  /**
   * いま結んだ問いを見える位置まで送る。列の外に生まれると、押したのに何も
   * 起きなかったように見える。結んだ本数が変わるたびに霞みも測り直す（列の箱の
   * 大きさは変わらないので、ResizeObserver は気づかない）。
   */
  const previousLinked = useRef<ReadonlySet<string>>(new Set(linkedQuestionIds));
  useEffect(() => {
    const rail = railRef.current;
    const added = [...linkedQuestionIds].find((id) => !previousLinked.current.has(id));
    previousLinked.current = new Set(linkedQuestionIds);
    if (!rail) return;
    setEdges(readRailEdges(rail));
    if (added === undefined) return;
    // id を選択子に埋め込まず、並びから探す（`CSS.escape` は jsdom に無い）。
    const chip = [...rail.children].find(
      (child) => child instanceof HTMLElement && child.dataset.questionId === added,
    );
    if (chip instanceof HTMLElement && typeof chip.scrollIntoView === 'function') {
      chip.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    }
  }, [linkedQuestionIds]);
  // 「足す」を隠すのは、**選べる問いを出し切ったときだけ**。
  // 押しても選べるものが無いボタンは「壊れている」と思わせるが、逆に
  // 問いがまだ1つも無いときに隠すと、紐づける入口そのものが消えてしまう
  // （面を開けば「まだ問いがありません」と言える）。
  const hasMoreToLink =
    activeQuestions.length === 0 || activeQuestions.some((q) => !linkedQuestionIds.has(q.id));

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
      <div
        ref={railRef}
        className="flex min-w-0 items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={railMaskStyle(edges)}
      >
        {/* チップ**全体**を外すボタンにしない。結んだ問いを確かめようと押しただけで
            消えてしまう（実際にそうなっていた）。外すのは × だけ。 */}
        {linked.map((q) => (
          <span key={q.id} data-question-id={q.id} className={chipClass} style={linkedChipStyle}>
            <span aria-hidden="true">◦</span>
            <span className="whitespace-nowrap">{q.currentText ?? t('untitled')}</span>
            <button
              type="button"
              onClick={() => onUnlink(q.id)}
              aria-label={t('unlink_aria', { text: q.currentText ?? t('untitled') })}
              className="-mr-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] opacity-45 transition-opacity duration-150 hover:opacity-100"
            >
              ×
            </button>
          </span>
        ))}
      </div>

      {/* 足す。**行の外**に置く——行は横に流れる（overflow）ので、中に置くと
          開いた面がその枠で切られてしまう。選べる問いが残っているときだけ出す。 */}
      <div className="relative shrink-0">
        {hasMoreToLink && (
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
        )}

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
