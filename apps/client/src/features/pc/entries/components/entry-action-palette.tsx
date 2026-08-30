'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';

export interface PaletteAction {
  id: string;
  label: string;
  icon: ReactNode;
  onSelect: () => void;
  /** 押せないときの理由。ホバーで出す（ボタンは非活性のまま）。 */
  disabledReason?: string;
  /** 押している最中（録音中など）。 */
  active?: boolean;
}

interface EntryActionPaletteProps {
  actions: PaletteAction[];
  /** フォーカスモードで本文以外を消しているあいだは false。 */
  visible: boolean;
}

const POSITION_KEY = 'oryzae-entry-palette-position';
const COLLAPSED_KEY = 'oryzae-entry-palette-collapsed';
const EDGE_MARGIN = 16;

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
    // 壊れた値・localStorage 不許可。既定位置に落とす。
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
 * **操作**をここに集める。本文の周りに操作を散らかさないためのもので、
 * ボードのツールバー（#524）と同じ「浮いた面」の記号に揃えている。
 *
 * 本文に被らせない方法は、場所を空けるのではなく**振る舞い**で解く:
 *  - 書いている間は消える（フォーカスモードと同じ `visible` に乗る）
 *  - 掴んで動かせる。位置は覚える
 *  - 畳んでアイコン1つにできる
 *
 * 押せない操作は非活性にして、理由はホバーで出す（「あと何字」を常時表示しない）。
 */
export function EntryActionPalette({ actions, visible }: EntryActionPaletteProps) {
  const t = useTranslations('editor.palette');
  const [position, setPosition] = useState<Position | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const dragOffsetRef = useRef<Position>({ x: 0, y: 0 });

  // 初回だけ localStorage から復元する（SSR では読めないので mount 後）。
  useEffect(() => {
    setPosition(readStoredPosition());
    setCollapsed(readStoredCollapsed());
  }, []);

  const clamp = useCallback((p: Position): Position => {
    const el = rootRef.current;
    const w = el?.offsetWidth ?? 240;
    const h = el?.offsetHeight ?? 48;
    const maxX = Math.max(EDGE_MARGIN, window.innerWidth - w - EDGE_MARGIN);
    const maxY = Math.max(EDGE_MARGIN, window.innerHeight - h - EDGE_MARGIN);
    return {
      x: Math.min(Math.max(EDGE_MARGIN, p.x), maxX),
      y: Math.min(Math.max(EDGE_MARGIN, p.y), maxY),
    };
  }, []);

  useEffect(() => {
    if (!dragging) return;
    function handleMove(e: PointerEvent) {
      setPosition(
        clamp({ x: e.clientX - dragOffsetRef.current.x, y: e.clientY - dragOffsetRef.current.y }),
      );
    }
    function handleUp() {
      setDragging(false);
    }
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
  }, [dragging, clamp]);

  // ドラッグが終わった位置を覚える。
  useEffect(() => {
    if (dragging || position === null) return;
    persist(POSITION_KEY, JSON.stringify(position));
  }, [dragging, position]);

  // 窓を縮めるとパレットが画面外へ出るので、そのつど引き戻す。
  useEffect(() => {
    if (position === null) return;
    function handleResize() {
      setPosition((p) => (p === null ? p : clamp(p)));
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [position, clamp]);

  function startDrag(e: React.PointerEvent) {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragOffsetRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setPosition({ x: rect.left, y: rect.top });
    setDragging(true);
  }

  function toggleCollapsed() {
    setCollapsed((v) => {
      persist(COLLAPSED_KEY, v ? '0' : '1');
      return !v;
    });
  }

  // 既定位置は画面下部中央。動かされていればその位置。
  const placement: React.CSSProperties =
    position === null
      ? { bottom: 28, left: '50%', transform: 'translateX(-50%)' }
      : { top: position.y, left: position.x };

  return (
    <div
      ref={rootRef}
      className={`fixed z-[1600] transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
      style={placement}
      {...verifyAttrs({
        unit: 'EntryActionPalette',
        visible,
        collapsed,
        dragging,
        actionCount: actions.length,
        moved: position !== null,
      })}
    >
      <div
        className="flex items-center gap-0.5 rounded-xl border border-[var(--border-subtle)] p-1"
        style={{
          background: 'color-mix(in srgb, var(--bg) 92%, transparent)',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 8px 24px -12px rgba(0,0,0,0.35)',
        }}
      >
        {/* 掴んで動かすための握り。ここ以外はボタンなのでドラッグの起点にしない。 */}
        <button
          type="button"
          onPointerDown={startDrag}
          aria-label={t('move')}
          className="flex h-8 w-4 cursor-grab items-center justify-center text-[var(--date-color)] active:cursor-grabbing"
        >
          <svg aria-hidden="true" width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
            <circle cx="3" cy="4" r="1" />
            <circle cx="7" cy="4" r="1" />
            <circle cx="3" cy="8" r="1" />
            <circle cx="7" cy="8" r="1" />
            <circle cx="3" cy="12" r="1" />
            <circle cx="7" cy="12" r="1" />
          </svg>
        </button>

        {!collapsed &&
          actions.map((action) => {
            const disabled = Boolean(action.disabledReason);
            return (
              // ホバーの検出は**ラッパー側**で行う。React は `disabled` な button に対して
              // onMouseEnter を含むマウス系イベントを抑止するので、ボタンに載せると
              // 「なぜ押せないか」の理由が永久に出ない。
              <span
                key={action.id}
                className="relative flex"
                onMouseEnter={() => setHoveredId(action.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <button
                  type="button"
                  // 本当の `disabled` にするとフォーカスも受けられず、キーボードからは
                  // 理由に到達できなくなる。押せないことは aria-disabled で伝え、
                  // 実行だけを止める。
                  aria-disabled={disabled}
                  onClick={() => {
                    if (disabled) return;
                    action.onSelect();
                  }}
                  aria-label={action.label}
                  data-palette-action={action.id}
                  onFocus={() => setHoveredId(action.id)}
                  onBlur={() => setHoveredId(null)}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                    disabled
                      ? 'cursor-default text-[var(--date-color)] opacity-35'
                      : action.active
                        ? 'text-red-500'
                        : 'text-[var(--date-color)] hover:bg-[var(--toolbar-hover)] hover:text-[var(--fg)]'
                  }`}
                >
                  {action.icon}
                </button>
                {hoveredId === action.id && (
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute bottom-full left-1/2 z-[1610] mb-1.5 w-max max-w-[15rem] -translate-x-1/2 rounded-md border border-[var(--border-subtle)] bg-[var(--bg)] px-2 py-1 text-[11px] leading-snug text-[var(--fg)] shadow-lg"
                  >
                    {action.disabledReason ?? action.label}
                  </span>
                )}
              </span>
            );
          })}

        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? t('expand') : t('collapse')}
          aria-expanded={!collapsed}
          className="flex h-8 w-6 items-center justify-center rounded-lg text-[var(--date-color)] transition-colors hover:bg-[var(--toolbar-hover)] hover:text-[var(--fg)]"
        >
          <svg
            aria-hidden="true"
            className="h-3.5 w-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              d={collapsed ? 'm9 18 6-6-6-6' : 'm15 18-6-6 6-6'}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
