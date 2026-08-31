'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import {
  CONTENT_CENTERED_STYLE,
  CONTROL_FONT,
  DISABLED_CLASS,
  ELEVATED_PANEL_CLASS,
  ELEVATED_PANEL_STYLE,
  HOVER_CLASS,
  ICON_SIZE,
  ICON_STROKE_WIDTH,
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
  actions: PaletteAction[];
  /** フォーカスモードで本文以外を消しているあいだは false。 */
  visible: boolean;
  /**
   * 位置と畳み具合を localStorage に覚えるか（既定 true）。
   * 孤立検証（verify）では fixture をまたいで状態が漏れるので false にする。
   */
  persistState?: boolean;
}

const POSITION_KEY = 'oryzae-entry-palette-position';
const COLLAPSED_KEY = 'oryzae-entry-palette-collapsed';
const EDGE_MARGIN = 12;

interface Position {
  x: number;
  y: number;
}

function readStoredPosition(): Position | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(POSITION_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'x' in parsed &&
      'y' in parsed &&
      typeof parsed.x === 'number' &&
      typeof parsed.y === 'number'
    ) {
      return { x: parsed.x, y: parsed.y };
    }
  } catch {
    // 壊れた値・localStorage 不許可。既定位置（下端中央）に落とす。
  }
  return null;
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
  persistState = true,
}: EntryActionPaletteProps) {
  const t = useTranslations('editor.palette');
  const [position, setPosition] = useState<Position | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const dragOffsetRef = useRef<Position>({ x: 0, y: 0 });
  // ドラッグ中に読む面の寸法。**掴んだ瞬間に一度だけ測る**（後述）。
  const dragSizeRef = useRef<{ w: number; h: number }>({ w: 240, h: 48 });
  // 次のフレームまで位置の反映を1回にまとめる（pointermove は1フレームに何度も来る）。
  const pendingRef = useRef<Position | null>(null);
  const frameRef = useRef<number | null>(null);

  // 初回だけ localStorage から復元する（SSR では読めないので mount 後）。
  useEffect(() => {
    if (!persistState) return;
    setPosition(readStoredPosition());
    setCollapsed(readStoredCollapsed());
  }, [persistState]);

  /**
   * 画面の中に収める。
   *
   * @param size 面の寸法。**呼び出し側が渡す**のが肝心で、ここで offsetWidth を読むと
   *   pointermove のたびにレイアウトが同期的に走る。本文の contentEditable と
   *   ゴーストのキャンバスを抱えた画面ではそれが数百 ms の詰まりになる
   *   （実測: INP Issue「Event handlers on this element blocked UI updates for 576ms」）。
   */
  const clamp = useCallback((p: Position, size?: { w: number; h: number }): Position => {
    const el = rootRef.current;
    const w = size?.w ?? el?.offsetWidth ?? 240;
    const h = size?.h ?? el?.offsetHeight ?? 48;
    const maxX = Math.max(EDGE_MARGIN, window.innerWidth - w - EDGE_MARGIN);
    const maxY = Math.max(EDGE_MARGIN, window.innerHeight - h - EDGE_MARGIN);
    return {
      x: Math.min(Math.max(EDGE_MARGIN, p.x), maxX),
      y: Math.min(Math.max(EDGE_MARGIN, p.y), maxY),
    };
  }, []);

  useEffect(() => {
    if (!dragging) return;

    // pointermove は1フレームに何度も来る。そのたびに state を書くと、
    // 描画1回ぶんの仕事に対して何度も再描画が走る。次のフレームで1回だけ反映する。
    function flush() {
      frameRef.current = null;
      const next = pendingRef.current;
      if (next) setPosition(next);
    }
    function handleMove(e: PointerEvent) {
      pendingRef.current = clamp(
        { x: e.clientX - dragOffsetRef.current.x, y: e.clientY - dragOffsetRef.current.y },
        dragSizeRef.current,
      );
      if (frameRef.current === null) frameRef.current = requestAnimationFrame(flush);
    }
    function handleUp() {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      if (pendingRef.current) setPosition(pendingRef.current);
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
  }, [dragging, clamp]);

  // ドラッグが終わった位置を覚える。
  useEffect(() => {
    if (!persistState || dragging || position === null) return;
    persist(POSITION_KEY, JSON.stringify(position));
  }, [persistState, dragging, position]);

  // 窓を縮めるとパレットが画面外へ出るので、そのつど引き戻す。
  useEffect(() => {
    if (position === null) return;
    function handleResize() {
      setPosition((p) => (p === null ? p : clamp(p)));
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [position, clamp]);

  /**
   * 面の余白部分を掴んだらドラッグを始める。
   *
   * 以前は幅 16px の握りだけを起点にしていて、狙って掴めなかった。ボタン以外の
   * どこを掴んでも動くようにする（ボタンの上では `closest` で弾く）。
   */
  function handleSurfacePointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    if (e.target instanceof Element && e.target.closest('button')) return;
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragOffsetRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    // 面の寸法はドラッグ中に変わらないので、ここで一度だけ測って持ち回る。
    dragSizeRef.current = { w: rect.width, h: rect.height };
    pendingRef.current = { x: rect.left, y: rect.top };
    setPosition({ x: rect.left, y: rect.top });
    setDragging(true);
  }

  function setCollapsedAndPersist(next: boolean) {
    setCollapsed(next);
    if (persistState) persist(COLLAPSED_KEY, next ? '1' : '0');
  }

  // 既定位置は本文領域（サイドバーを除いた部分）の下端中央。動かされていればその位置。
  // 畳んでいるあいだは常に下端へ戻る（つまみは端に貼りついているのが自然）。
  const docked = collapsed || position === null;
  const placement: React.CSSProperties = docked
    ? { bottom: collapsed ? 0 : 24, ...CONTENT_CENTERED_STYLE }
    : { top: position.y, left: position.x };

  const contract = verifyAttrs({
    unit: 'EntryActionPalette',
    visible,
    collapsed,
    dragging,
    actionCount: actions.length,
    docked,
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
          className={`flex h-7 w-20 items-center justify-center rounded-t-[13px] border border-b-0 transition-colors ${HOVER_CLASS}`}
          style={{ ...ELEVATED_PANEL_STYLE, ...CONTROL_FONT }}
        >
          <svg
            aria-hidden="true"
            width={ICON_SIZE}
            height={ICON_SIZE}
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
        style={{ ...ELEVATED_PANEL_STYLE, ...CONTROL_FONT }}
        onPointerDown={handleSurfacePointerDown}
      >
        {/* 掴み手。面のどこでもドラッグの起点にはなるが、実際にはボタンが敷き詰められていて
            掴める余白は外周 6px しか残らない（実測: 面 250px 中 248px がボタン）。
            掴める場所がある、と分かる幅を確保する。 */}
        <span
          aria-hidden="true"
          className="flex h-9 w-4 shrink-0 items-center justify-center"
          style={{ color: 'var(--date-color)' }}
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
                  action.onSelect();
                }}
                aria-label={action.label}
                data-palette-action={action.id}
                onFocus={() => setHoveredId(action.id)}
                onBlur={() => setHoveredId(null)}
                className={`${TOOL_BUTTON_CLASS} ${
                  disabled ? DISABLED_CLASS : action.active ? '' : HOVER_CLASS
                }`}
                style={
                  action.active
                    ? { backgroundColor: 'var(--accent)', color: '#fff' }
                    : { color: 'var(--fg)' }
                }
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
          onClick={() => setCollapsedAndPersist(true)}
          aria-expanded={true}
          aria-label={t('collapse')}
          className={`${TOOL_BUTTON_CLASS} ${HOVER_CLASS}`}
          style={{ color: 'var(--date-color)' }}
        >
          <svg
            aria-hidden="true"
            width={ICON_SIZE}
            height={ICON_SIZE}
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
