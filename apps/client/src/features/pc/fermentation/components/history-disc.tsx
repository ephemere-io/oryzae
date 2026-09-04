'use client';

import { verifyAttrs } from '@oryzae/verify';
import { QuestionCircle } from '@/features/pc/fermentation/components/question-circle';
import type { DiscPlacement } from '@/features/pc/fermentation/utils/cover-flow-geometry';
import type { FermentationDetail } from '@/features/shared/fermentation/types';

/** 円盤の下に敷く半透明の皿。背景の瓶をうっすら透かすために不透明にしない。 */
function plateStyle(active: boolean): React.CSSProperties {
  return {
    position: 'absolute',
    inset: 0,
    borderRadius: '50%',
    background: active
      ? 'radial-gradient(circle at 50% 38%, rgba(255,255,255,0.52), rgba(253,251,247,0.3))'
      : 'radial-gradient(circle at 50% 38%, rgba(255,255,255,0.46), rgba(247,242,229,0.26))',
    backdropFilter: 'blur(3px)',
    WebkitBackdropFilter: 'blur(3px)',
    border: '1px solid rgba(140,133,126,0.18)',
    boxShadow: active
      ? '0 22px 48px rgba(140,133,126,0.18), inset 0 0 40px rgba(255,255,255,0.7)'
      : '0 12px 28px rgba(140,133,126,0.12)',
    // 正面の皿はクリックを吸わない（中身の要素と背景のヒットテストに任せる）。
    pointerEvents: active ? 'none' : 'auto',
    transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
  };
}

interface HistoryDiscProps {
  questionText: string;
  /** 正面か。正面だけが中身（言葉・抜粋・手紙）を開く。 */
  active: boolean;
  /** 正面の隣（|offset| === 1）か。ここだけ日付スタンプを出す。 */
  adjacent: boolean;
  placement: DiscPlacement;
  /** 正面の発酵の詳細。未取得・非正面なら null。 */
  detail: FermentationDetail | null;
  /** 機械ラベルの日付 'YYYY-MM-DD'。 */
  dateStamp: string;
  /** 期間ラベル 'WEEK 35'（未読なら ' · NEW' 付き）。 */
  periodStamp: string;
  unread: boolean;
  /** ドラッグ中は transition を切って指に追従させる。 */
  dragging: boolean;
  /** 正面でない円盤を押したとき。正面では undefined。 */
  onActivate?: () => void;
  onElementClick: (
    type: 'keyword' | 'snippet' | 'letter',
    id: string,
    data: Record<string, string>,
  ) => void;
  selectedElementId: string | null;
}

const NOOP_DRAG = () => {};
const NOOP_POINTER_HANDLERS = {
  onPointerDown: NOOP_DRAG,
  onPointerMove: NOOP_DRAG,
  onPointerUp: NOOP_DRAG,
  onPointerCancel: NOOP_DRAG,
  onClick: NOOP_DRAG,
};
const NO_OVERRIDES = { keywords: {}, snippets: {}, letters: {} };

/**
 * 発酵履歴の円盤 1 枚（1 発酵 = 1 円盤）。
 *
 * 中身は瓶と同じ `QuestionCircle` を使う。正面だけ `detail` を渡して言葉・抜粋・手紙を開き、
 * 隣は `detail={null}`（＝空状態の漂う微生物）に日付スタンプを重ねる。「まだ開いていない回」
 * が絵として立つのと、正面以外の本文を取りに行かなくて済むのが同時に成立する。
 *
 * 円周の問いテキストは出さない（画面上部に同じ問いが出るので二重になる）。中の要素は
 * 掴ませない（3D で倒してあるので getBoundingClientRect が歪み、% が正しく出ない）。
 */
export function HistoryDisc({
  questionText,
  active,
  adjacent,
  placement,
  detail,
  dateStamp,
  periodStamp,
  unread,
  dragging,
  onActivate,
  onElementClick,
  selectedElementId,
}: HistoryDiscProps) {
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: 円盤の操作は role="button" を持つ内側の QuestionCircle（onActivate）とステージ背景のヒットテストが担う。この層は 3D 変形の器で、ここに role を足すと同じ操作に取っ手が二重にできる。
    // biome-ignore lint/a11y/useKeyWithClickEvents: 同上。キーボードでのめくりは ← → キー（useCoverFlowInput）が画面全体で受ける。
    <div
      {...verifyAttrs({
        unit: 'HistoryDisc',
        active,
        adjacent,
        hasDetail: Boolean(detail),
        unread,
        dateStamp,
      })}
      onClick={
        onActivate
          ? (e) => {
              // ステージ背景のヒットテストまで届かせない（二重にめくれる）。
              e.stopPropagation();
              onActivate();
            }
          : undefined
      }
      style={{
        position: 'absolute',
        left: '50%',
        top: '47%',
        width: `${placement.size}px`,
        height: `${placement.size}px`,
        zIndex: placement.zIndex,
        opacity: placement.opacity,
        transform: `translate(-50%, -50%) translateX(${placement.translateX}px) translateZ(${placement.translateZ}px) rotateY(${placement.rotateY}deg) scale(${placement.scale})`,
        transformStyle: 'preserve-3d',
        transition: dragging ? 'none' : 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
        pointerEvents: 'auto',
        cursor: active ? 'default' : 'pointer',
        filter: active ? 'none' : 'saturate(0.7)',
      }}
    >
      <div style={plateStyle(active)} />

      <QuestionCircle
        questionId={`disc-${dateStamp}`}
        questionText={questionText}
        detail={active ? detail : null}
        zoomed={active}
        size={placement.size}
        showRing={false}
        elementsDraggable={false}
        innerOverrides={NO_OVERRIDES}
        selectedElementId={selectedElementId}
        onElementClick={onElementClick}
        onInnerDragMove={NOOP_DRAG}
        onInnerDragEnd={NOOP_DRAG}
        circlePointerHandlers={NOOP_POINTER_HANDLERS}
        onActivate={onActivate ?? NOOP_DRAG}
        isDraggingCircle={false}
        style={{ left: '50%', top: '50%' }}
      />

      {adjacent && (
        <div
          data-verify-part="date-stamp"
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '7px',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          <span
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '15px',
              letterSpacing: '0.22em',
              color: unread ? 'var(--ob-jar-warm)' : 'var(--fg)',
              opacity: unread ? 0.85 : 0.55,
            }}
          >
            {dateStamp}
          </span>
          <span
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '9px',
              letterSpacing: '0.3em',
              color: unread ? 'var(--ob-jar-warm)' : 'var(--date-color)',
            }}
          >
            {periodStamp}
          </span>
        </div>
      )}
    </div>
  );
}
