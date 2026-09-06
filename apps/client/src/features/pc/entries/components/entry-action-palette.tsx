'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  CONTENT_CENTERED_STYLE,
  CONTROL_FONT,
  DISABLED_CLASS,
  ELEVATED_PANEL_CLASS,
  ELEVATED_PANEL_STYLE,
  HOVER_CLASS,
  ICON_STROKE_WIDTH,
  type PaletteSize,
  paletteScale,
  TOOL_BUTTON_CLASS,
} from '@/components/ui/surface';

export interface PaletteAction {
  id: string;
  label: string;
  icon: ReactNode;
  onSelect: () => void;
  /** 押せないときの理由。ホバーで出す（ボタンは押せないまま）。 */
  disabledReason?: string;
  /** 押している最中（録音中など）。 */
  active?: boolean;
}

interface EntryActionPaletteProps {
  /** 道具の大きさ（設定で変えられる）。既定は medium。 */
  size?: PaletteSize;
  actions: PaletteAction[];
  /** フォーカスモードで本文以外を消しているあいだは false。 */
  visible: boolean;
  /**
   * 位置と畳み具合を localStorage に覚えるか（既定 true）。
   * 孤立検証（verify）では fixture をまたいで状態が漏れるので false にする。
   */
  persistState?: boolean;
}

// 旧 `oryzae-entry-palette-position`（左上からの px）とは別の鍵にする。
// 同じ鍵のまま意味を変えると、前の値が新しい意味で読まれて明後日の場所に出る。
const ANCHOR_KEY = 'oryzae-entry-palette-anchor';
const COLLAPSED_KEY = 'oryzae-entry-palette-collapsed';
/** これ以上動いて初めて「掴んだ」と見なす（px）。 */
const DRAG_THRESHOLD = 4;

const EDGE_MARGIN = 12;

interface Position {
  x: number;
  y: number;
}

interface Size {
  w: number;
  h: number;
}

/**
 * パレットの居場所。**画面の左上からの px ではなく、近いほうの端からの距離で持つ。**
 *
 * 左上からの px で持つと、窓が縦に伸びたときに伸びたぶんが丸ごと下の余白になる。
 * 全画面はまさにそれで、ブラウザのヘッダーが消えたぶん窓が高くなり、下に置いたはずの
 * パレットが画面の中ほどまで浮き上がって見えていた。
 *
 * 端からの距離なら、下に置いたものは下に、右に置いたものは右に残る。
 * **ヘッダーの高さを数える必要がない**ので、ブラウザや OS が変わっても、
 * ツールバーの有無が変わっても同じように効く。
 */
interface Anchor {
  xEdge: 'left' | 'right';
  x: number;
  yEdge: 'top' | 'bottom';
  y: number;
}

function isEdgeX(value: unknown): value is 'left' | 'right' {
  return value === 'left' || value === 'right';
}

function isEdgeY(value: unknown): value is 'top' | 'bottom' {
  return value === 'top' || value === 'bottom';
}

function readStoredAnchor(): Anchor | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(ANCHOR_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'x' in parsed &&
      'y' in parsed &&
      'xEdge' in parsed &&
      'yEdge' in parsed &&
      typeof parsed.x === 'number' &&
      typeof parsed.y === 'number' &&
      isEdgeX(parsed.xEdge) &&
      isEdgeY(parsed.yEdge)
    ) {
      return { xEdge: parsed.xEdge, x: parsed.x, yEdge: parsed.yEdge, y: parsed.y };
    }
  } catch {
    // 壊れた値・localStorage 不許可。既定位置（下端中央）に落とす。
  }
  return null;
}

/**
 * 画面の中に収めたうえで、**近いほうの端**に留める。
 *
 * @param size 面の寸法。**呼び出し側が渡す**のが肝心で、ここで offsetWidth を読むと
 *   pointermove のたびにレイアウトが同期的に走る。本文の contentEditable と
 *   ゴーストのキャンバスを抱えた画面ではそれが数百 ms の詰まりになる
 *   （実測: INP Issue「Event handlers on this element blocked UI updates for 576ms」）。
 */
function toAnchor(left: number, top: number, size: Size): Anchor {
  const maxX = Math.max(EDGE_MARGIN, window.innerWidth - size.w - EDGE_MARGIN);
  const maxY = Math.max(EDGE_MARGIN, window.innerHeight - size.h - EDGE_MARGIN);
  const clampedLeft = Math.min(Math.max(EDGE_MARGIN, left), maxX);
  const clampedTop = Math.min(Math.max(EDGE_MARGIN, top), maxY);
  const rightGap = Math.max(EDGE_MARGIN, window.innerWidth - clampedLeft - size.w);
  const bottomGap = Math.max(EDGE_MARGIN, window.innerHeight - clampedTop - size.h);
  const nearLeft = clampedLeft <= rightGap;
  const nearTop = clampedTop <= bottomGap;
  return {
    xEdge: nearLeft ? 'left' : 'right',
    x: nearLeft ? clampedLeft : rightGap,
    yEdge: nearTop ? 'top' : 'bottom',
    y: nearTop ? clampedTop : bottomGap,
  };
}

/** 窓が縮んで端からの距離が入らなくなったときに引き戻す。端の選択は変えない。 */
function clampAnchor(anchor: Anchor, size: Size): Anchor {
  const maxX = Math.max(EDGE_MARGIN, window.innerWidth - size.w - EDGE_MARGIN);
  const maxY = Math.max(EDGE_MARGIN, window.innerHeight - size.h - EDGE_MARGIN);
  return {
    ...anchor,
    x: Math.min(Math.max(EDGE_MARGIN, anchor.x), maxX),
    y: Math.min(Math.max(EDGE_MARGIN, anchor.y), maxY),
  };
}

function readStoredCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

function persist(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // 保存できなくても操作は続けられる。
  }
}

/**
 * エントリー画面の操作をまとめたフローティングパレット。
 *
 * 「問いを結ぶ」「漬け込む」「写真から文字を起こす」「全画面」「音声入力」といった
 * **操作**をここに集める。本文の周りに操作を散らかさないためのもので、面の素材と寸法は
 * ボードのツールバー（#524）と同じ `components/ui/surface` を参照する。
 *
 * 本文に被らせない方法は、場所を空けるのではなく**振る舞い**で解く:
 *  - 書いている間は消える（フォーカスモードと同じ `visible` に乗る）
 *  - **畳むと画面の下端に貼りつき、上向きの小さなつまみだけになる**
 *  - 面のどこを掴んでも動かせる。位置は覚える
 *
 * 押せない操作は `aria-disabled` にして、理由はホバーで出す。本当の `disabled` にすると
 * React がマウス系イベントを抑止し、フォーカスも受けないため、理由に到達できなくなる。
 */
export function EntryActionPalette({
  actions,
  visible,
  size = 'medium',
  persistState = true,
}: EntryActionPaletteProps) {
  // 面・ボタン・アイコン・角丸は**まとめて**動かす（1つだけ変えると比率が崩れる）。
  const scale = paletteScale(size);
  const t = useTranslations('editor.palette');
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const dragOffsetRef = useRef<Position>({ x: 0, y: 0 });
  // ドラッグ中に読む面の寸法。**掴んだ瞬間に一度だけ測る**（後述）。
  const dragSizeRef = useRef<Size>({ w: 240, h: 48 });
  // 次のフレームまで位置の反映を1回にまとめる（pointermove は1フレームに何度も来る）。
  const pendingRef = useRef<Anchor | null>(null);
  const frameRef = useRef<number | null>(null);
  // 掴んだ位置と、そこから実際に動いたか。押しただけならボタンのクリックとして通す。
  const dragStartRef = useRef<Position>({ x: 0, y: 0 });
  const movedRef = useRef(false);

  // 初回だけ localStorage から復元する（SSR では読めないので mount 後）。
  useEffect(() => {
    if (!persistState) return;
    setAnchor(readStoredAnchor());
    setCollapsed(readStoredCollapsed());
  }, [persistState]);

  useEffect(() => {
    if (!dragging) return;

    // pointermove は1フレームに何度も来る。そのたびに state を書くと、
    // 描画1回ぶんの仕事に対して何度も再描画が走る。次のフレームで1回だけ反映する。
    function flush() {
      frameRef.current = null;
      const next = pendingRef.current;
      if (next) setAnchor(next);
    }
    function handleMove(e: PointerEvent) {
      if (!movedRef.current) {
        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;
        // 指1本ぶんも動いていないなら、それは「掴んだ」ではなく「押した」。
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        movedRef.current = true;
      }
      pendingRef.current = toAnchor(
        e.clientX - dragOffsetRef.current.x,
        e.clientY - dragOffsetRef.current.y,
        dragSizeRef.current,
      );
      if (frameRef.current === null) frameRef.current = requestAnimationFrame(flush);
    }
    function handleUp() {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      if (pendingRef.current) setAnchor(pendingRef.current);
      setDragging(false);
    }
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [dragging]);

  // ドラッグが終わった位置を覚える。
  useEffect(() => {
    if (!persistState || dragging || anchor === null) return;
    persist(ANCHOR_KEY, JSON.stringify(anchor));
  }, [persistState, dragging, anchor]);

  // 窓を縮めるとパレットが画面外へ出るので、そのつど引き戻す。
  // **全画面の出入りもここに乗せる**——resize が来る保証がないブラウザがある。
  // 端からの距離で持っているので、ここでするのは「入りきらない距離を詰める」だけ。
  useEffect(() => {
    if (anchor === null) return;
    function handleResize() {
      const el = rootRef.current;
      const size: Size = { w: el?.offsetWidth ?? 240, h: el?.offsetHeight ?? 48 };
      setAnchor((a) => (a === null ? a : clampAnchor(a, size)));
    }
    window.addEventListener('resize', handleResize);
    document.addEventListener('fullscreenchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('fullscreenchange', handleResize);
    };
  }, [anchor]);

  /**
   * 面のどこを掴んでもドラッグを始める。**ボタンの上も含む。**
   *
   * 以前はボタンの上を `closest` で弾いていたが、面はほぼ全域がボタンで
   * （実測: 面 250px 中 248px）、掴める余白は外周に数 px しか残らない。
   * 掴んだつもりが動かない、が起きるのはこれが理由。
   *
   * 代わりに**動いた距離**で区別する: DRAG_THRESHOLD を超えて初めてドラッグと見なし、
   * 超えなければただのクリックとしてボタンに通す（超えた場合はその後の click を食う）。
   */
  function handleSurfacePointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragOffsetRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    // 面の寸法はドラッグ中に変わらないので、ここで一度だけ測って持ち回る。
    dragSizeRef.current = { w: rect.width, h: rect.height };
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    movedRef.current = false;
    const startAnchor = toAnchor(rect.left, rect.top, dragSizeRef.current);
    pendingRef.current = startAnchor;
    setAnchor(startAnchor);
    setDragging(true);
  }

  function setCollapsedAndPersist(next: boolean) {
    setCollapsed(next);
    if (persistState) persist(COLLAPSED_KEY, next ? '1' : '0');
  }

  // 既定位置は本文領域（サイドバーを除いた部分）の下端中央。動かされていればその位置。
  // 畳んでいるあいだは常に下端へ戻る（つまみは端に貼りついているのが自然）。
  const docked = collapsed || anchor === null;
  // 端は動的なキーになるが、`as` を使わずに書ける（分岐ごとに素直に組む）。
  const placement: React.CSSProperties = docked
    ? { bottom: collapsed ? 0 : 24, ...CONTENT_CENTERED_STYLE }
    : {
        ...(anchor.yEdge === 'top' ? { top: anchor.y } : { bottom: anchor.y }),
        ...(anchor.xEdge === 'left' ? { left: anchor.x } : { right: anchor.x }),
      };

  const contract = verifyAttrs({
    unit: 'EntryActionPalette',
    visible,
    collapsed,
    dragging,
    actionCount: actions.length,
    docked,
    size,
  });

  const wrapperClass = `fixed z-[1600] transition-opacity duration-300 ${
    visible ? 'opacity-100' : 'pointer-events-none opacity-0'
  }`;

  if (collapsed) {
    return (
      <div ref={rootRef} className={wrapperClass} style={placement} {...contract}>
        <button
          type="button"
          onClick={() => setCollapsedAndPersist(false)}
          aria-expanded={false}
          aria-label={t('expand')}
          className={`flex items-center justify-center border border-b-0 transition-colors ${HOVER_CLASS}`}
          style={{
            height: scale.button - 16,
            width: scale.button * 2,
            borderTopLeftRadius: scale.panelRadius,
            borderTopRightRadius: scale.panelRadius,
            ...ELEVATED_PANEL_STYLE,
            ...CONTROL_FONT,
          }}
        >
          <svg
            aria-hidden="true"
            width={scale.icon}
            height={scale.icon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={ICON_STROKE_WIDTH}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: 'var(--date-color)' }}
          >
            <path d="m6 15 6-6 6 6" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div ref={rootRef} className={wrapperClass} style={placement} {...contract}>
      <div
        className={`${ELEVATED_PANEL_CLASS} ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{
          gap: scale.gap,
          padding: scale.pad,
          borderRadius: scale.panelRadius,
          ...ELEVATED_PANEL_STYLE,
          ...CONTROL_FONT,
        }}
        onPointerDown={handleSurfacePointerDown}
      >
        {/* 掴み手。面のどこでもドラッグの起点にはなるが、実際にはボタンが敷き詰められていて
            掴める余白は外周 6px しか残らない（実測: 面 250px 中 248px がボタン）。
            掴める場所がある、と分かる幅を確保する。 */}
        <span
          aria-hidden="true"
          className="flex shrink-0 items-center justify-center"
          style={{ height: scale.button, width: 16, color: 'var(--date-color)' }}
        >
          <svg
            aria-hidden="true"
            width={10}
            height={18}
            viewBox="0 0 10 18"
            fill="currentColor"
            opacity={0.5}
          >
            <circle cx="3" cy="5" r="1" />
            <circle cx="7" cy="5" r="1" />
            <circle cx="3" cy="9" r="1" />
            <circle cx="7" cy="9" r="1" />
            <circle cx="3" cy="13" r="1" />
            <circle cx="7" cy="13" r="1" />
          </svg>
        </span>

        {actions.map((action) => {
          const disabled = Boolean(action.disabledReason);
          return (
            // ホバーの検出は**ラッパー側**で行う。React は `disabled` な button に対して
            // onMouseEnter を抑止するため、押せない操作の理由が出なくなる。
            // biome-ignore lint/a11y/noStaticElementInteractions: ホバーは理由の補足表示だけで、操作そのものは中の button が担う（onFocus/onBlur でキーボードからも同じ理由に到達できる）
            <span
              key={action.id}
              className="relative flex"
              onMouseEnter={() => setHoveredId(action.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <button
                type="button"
                aria-disabled={disabled}
                onClick={() => {
                  if (disabled) return;
                  // 掴んで動かした直後の click は、操作ではなく移動の余韻。
                  if (movedRef.current) {
                    movedRef.current = false;
                    return;
                  }
                  action.onSelect();
                }}
                aria-label={action.label}
                data-palette-action={action.id}
                onFocus={() => setHoveredId(action.id)}
                onBlur={() => setHoveredId(null)}
                className={`${TOOL_BUTTON_CLASS} ${
                  disabled ? DISABLED_CLASS : action.active ? '' : HOVER_CLASS
                }`}
                style={{
                  height: scale.button,
                  width: scale.button,
                  borderRadius: scale.buttonRadius,
                  ...(action.active
                    ? { backgroundColor: 'var(--accent)', color: '#fff' }
                    : { color: 'var(--fg)' }),
                }}
              >
                {action.icon}
              </button>
              {hoveredId === action.id && (
                <span
                  role="tooltip"
                  className="pointer-events-none absolute bottom-full left-1/2 z-[1610] mb-2 max-w-[16rem] -translate-x-1/2 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-medium"
                  style={{ backgroundColor: 'var(--fg)', color: 'var(--bg)', ...CONTROL_FONT }}
                >
                  {action.disabledReason ?? action.label}
                </span>
              )}
            </span>
          );
        })}

        <button
          type="button"
          onClick={() => {
            if (movedRef.current) {
              movedRef.current = false;
              return;
            }
            setCollapsedAndPersist(true);
          }}
          aria-expanded={true}
          aria-label={t('collapse')}
          className={`${TOOL_BUTTON_CLASS} ${HOVER_CLASS}`}
          style={{
            height: scale.button,
            width: scale.button,
            borderRadius: scale.buttonRadius,
            color: 'var(--date-color)',
          }}
        >
          <svg
            aria-hidden="true"
            width={scale.icon}
            height={scale.icon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={ICON_STROKE_WIDTH}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
