'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useMemo } from 'react';
import { QuestionCircle } from '@/features/pc/fermentation/components/question-circle';
import type { DiscPlacement } from '@/features/pc/fermentation/utils/cover-flow-geometry';
import type { FermentationDetail } from '@/features/shared/fermentation/types';

interface Pos {
  jarX: number;
  jarY: number;
}

interface InnerOverrides {
  keywords: Record<string, Pos>;
  snippets: Record<string, Pos>;
  letters: Record<string, Pos>;
}

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
  /** ユーザーが動かした中身の位置（瓶と共有する。保存もそちらの経路に乗る）。 */
  innerOverrides: InnerOverrides;
  onInnerDragMove: (
    type: 'keyword' | 'snippet' | 'letter',
    id: string,
    x: number,
    y: number,
  ) => void;
  onInnerDragEnd: (
    type: 'keyword' | 'snippet' | 'letter',
    id: string,
    x: number,
    y: number,
  ) => void;
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
/**
 * 円盤の中の要素の大きさ（素の寸法の何倍か）。
 *
 * 瓶のキャンバスでは円の直径から出した倍率（直径 420 なら 0.39）で縮めている。円へ
 * **カメラが寄る**ので、縮んでいても寄れば読めるからだ。履歴はカメラが動かないので、
 * 同じ倍率だと 9px の抜粋が 4px 相当で乗り、まったく読めない。
 *
 * 素の寸法（1.0）で出す。言葉が 11px・抜粋が 9px の設計どおりに読める。
 */
const DISC_ELEMENT_SCALE = 1;

/**
 * 円盤の中の配置（円の内側比・要素の左上を指す）。
 *
 * 瓶に保存されている配置は使わない。あちらは直径 420 の円に **0.39 倍**で並べる前提の
 * 座標なので、素の寸法で置くと右の要素が円からはみ出し、要素どうしも重なる（実データの
 * 言葉 5 件・抜粋 3 件で確認）。
 *
 * 左右 2 列に分け、列の中で縦にずらす。列の x は「いちばん幅の広い言葉（英語で 170px ≒
 * 円の 36%）を置いても円の内側に収まる」ように決めてある。ユーザーが瓶で並べ替えた配置を
 * 反映しないのは意図的で、履歴は **読むための面**（瓶は並べるための面）。
 */
const DISC_KEYWORD_POSITIONS = [
  { jarX: 50, jarY: 18 },
  { jarX: 10, jarY: 30 },
  { jarX: 10, jarY: 42 },
  { jarX: 50, jarY: 52 },
  { jarX: 46, jarY: 65 },
];
const DISC_SNIPPET_POSITIONS = [
  { jarX: 10, jarY: 14 },
  { jarX: 50, jarY: 34 },
  { jarX: 10, jarY: 55 },
];
const DISC_LETTER_POSITION = { jarX: 28, jarY: 75 };

/**
 * 円盤の中の配置を決める。優先順位は **ユーザーが動かした位置 > 保存された位置 >
 * 円盤の既定**。
 *
 * `QuestionCircle` の内蔵フォールバックには落とさない。あれは 0.39 倍に縮めて置く前提の
 * 座標なので、素の寸法で並べる円盤では右へはみ出して重なる。
 */
function discOverrides(detail: FermentationDetail | null, dragged: InnerOverrides): InnerOverrides {
  if (!detail) return { keywords: {}, snippets: {}, letters: {} };
  const place = (
    items: readonly { id: string; jarX: number | null; jarY: number | null }[],
    defaults: readonly Pos[],
    live: Record<string, Pos>,
  ): Record<string, Pos> => {
    const out: Record<string, Pos> = {};
    items.forEach((item, i) => {
      const fallback = defaults[i] ?? defaults[defaults.length - 1];
      out[item.id] =
        live[item.id] ??
        (item.jarX != null && item.jarY != null ? { jarX: item.jarX, jarY: item.jarY } : fallback);
    });
    return out;
  };
  return {
    keywords: place(detail.keywords, DISC_KEYWORD_POSITIONS, dragged.keywords),
    snippets: place(detail.snippets, DISC_SNIPPET_POSITIONS, dragged.snippets),
    letters: detail.letter ? place([detail.letter], [DISC_LETTER_POSITION], dragged.letters) : {},
  };
}

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
  innerOverrides,
  onInnerDragMove,
  onInnerDragEnd,
  onActivate,
  onElementClick,
  selectedElementId,
}: HistoryDiscProps) {
  const placed = useMemo(
    () => discOverrides(active ? detail : null, innerOverrides),
    [active, detail, innerOverrides],
  );

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
        // 正面の円盤だけ掴める。隣は rotateY で倒れていて getBoundingClientRect が
        // 歪むため（% が正しく出ない）、そもそも中身も開いていない。
        elementsDraggable={active}
        elementScale={DISC_ELEMENT_SCALE}
        innerOverrides={placed}
        selectedElementId={selectedElementId}
        onElementClick={onElementClick}
        onInnerDragMove={onInnerDragMove}
        onInnerDragEnd={onInnerDragEnd}
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
