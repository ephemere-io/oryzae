'use client';

import { verifyAttrs } from '@oryzae/verify';
import { type ReactNode, useEffect, useState } from 'react';
import { anchorStyle, useDraggableSurface } from '@/lib/use-draggable-surface';
import {
  CONTENT_CENTERED_STYLE,
  CONTROL_FONT,
  ELEVATED_PANEL_CLASS,
  ELEVATED_PANEL_STYLE,
  HOVER_CLASS,
  ICON_STROKE_WIDTH,
  type PaletteSize,
  paletteScale,
  TOOL_BUTTON_CLASS,
} from './surface';

type PaletteScale = ReturnType<typeof paletteScale>;
type ContractValue = string | number | boolean;

/** 位置と畳み具合を憶える localStorage の鍵。 */
interface FloatingPaletteStorage {
  anchor: string;
  collapsed: string;
}

/** 中身（道具のボタン）を描くときに渡すもの。 */
interface FloatingPaletteSlot {
  scale: PaletteScale;
  /**
   * 直前の操作が「掴んで動かした」だったか。**読むと下がる**。ボタンの `onClick` の
   * 先頭で読み、true ならクリックを捨てる（動かした直後の click は操作ではなく余韻）。
   */
  consumeMoved: () => boolean;
}

export interface FloatingPaletteProps {
  /** 検証の契約。畳み具合・掴んでいるか・定位置かはここが足す。 */
  contract: { unit: string } & Record<string, ContractValue>;
  size?: PaletteSize;
  /** 集中モード等で消しているあいだは false（クリックも透過する）。 */
  visible?: boolean;
  /** null なら憶えない（孤立検証では fixture をまたいで漏れるので null にする）。 */
  storage: FloatingPaletteStorage | null;
  /** 動かされていないときの、下端からの距離（px）。 */
  dockBottom?: number;
  collapseLabel: string;
  expandLabel: string;
  /** 面そのものの役割。ボードは道具の列なので toolbar。 */
  role?: 'toolbar';
  ariaLabel?: string;
  /**
   * 面の上の操作を下へ伝えない。ボードは盤面の外側クリックで選択を外すので、
   * 道具を押したつもりが選択まで外れてしまう。
   */
  isolateEvents?: boolean;
  children: (slot: FloatingPaletteSlot) => ReactNode;
}

function readFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === '1';
  } catch {
    // private mode など。畳んでいないものとして出す。
    return false;
  }
}

function writeFlag(key: string, value: boolean): void {
  try {
    window.localStorage.setItem(key, value ? '1' : '0');
  } catch {
    // 憶えられないだけで、操作は続けられる。
  }
}

/**
 * 画面に浮かぶ操作パレット。**エントリーとボードが同じこれを使う。**
 *
 * 以前は 2 つが別々に作られていて、エントリーは掴んで動かせて畳めるのに、ボードは
 * 動かせても畳めない、掴み手も無い、ボタンの大きさも違う — と少しずつずれていた。
 * 「同じコンポーネントを使っていてほしい」と報告されたので、振る舞いと見た目の
 * 殻をここに 1 つだけ置く。中に並べる道具は各画面が決める。
 *
 * - 面のどこを掴んでも動かせる。位置は近いほうの端からの距離で憶える
 *   （`useDraggableSurface`）
 * - 畳むと本文領域の下端中央に貼りつき、上向きの小さなつまみだけになる
 * - 消えているあいだ（`visible=false`）はクリックを透過する
 *
 * 画面ごとの差は `dockBottom`（定位置の高さ）と、畳み具合を憶える鍵だけ。
 */
export function FloatingPalette({
  contract,
  size = 'medium',
  visible = true,
  storage,
  dockBottom = 24,
  collapseLabel,
  expandLabel,
  role,
  ariaLabel,
  isolateEvents = false,
  children,
}: FloatingPaletteProps) {
  // 面・ボタン・アイコン・角丸は**まとめて**動かす（1 つだけ変えると比率が崩れる）。
  const scale = paletteScale(size);
  const surface = useDraggableSurface(storage?.anchor ?? null);

  const collapsedKey = storage?.collapsed ?? null;
  const [collapsed, setCollapsed] = useState(false);
  // SSR では読めないので mount 後。
  useEffect(() => {
    if (collapsedKey !== null) setCollapsed(readFlag(collapsedKey));
  }, [collapsedKey]);

  function setCollapsedAndPersist(next: boolean) {
    setCollapsed(next);
    if (collapsedKey !== null) writeFlag(collapsedKey, next);
  }

  // 定位置は本文領域（サイドバーを除いた部分）の下端中央。動かされていればその位置。
  // 畳んでいるあいだは常に下端へ戻る（つまみは端に貼りついているのが自然）。
  const docked = collapsed || surface.anchor === null;
  const placement: React.CSSProperties = docked
    ? { bottom: collapsed ? 0 : dockBottom, ...CONTENT_CENTERED_STYLE }
    : (anchorStyle(surface.anchor) ?? {});

  const attrs = verifyAttrs({
    ...contract,
    visible,
    collapsed,
    dragging: surface.dragging,
    docked,
  });

  const wrapperClass = `fixed z-[1600] transition-opacity duration-300 ${
    visible ? 'opacity-100' : 'pointer-events-none opacity-0'
  }`;

  if (collapsed) {
    return (
      <div ref={surface.rootRef} className={wrapperClass} style={placement} {...attrs}>
        <button
          type="button"
          onClick={(event) => {
            if (isolateEvents) event.stopPropagation();
            setCollapsedAndPersist(false);
          }}
          aria-expanded={false}
          aria-label={expandLabel}
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
          <ChevronIcon size={scale.icon} direction="up" />
        </button>
      </div>
    );
  }

  return (
    <div ref={surface.rootRef} className={wrapperClass} style={placement} {...attrs}>
      <div
        // 役割があるときだけ名前も付ける（役割の無い div に aria-label は効かない）。
        {...(role === undefined ? {} : { role, 'aria-label': ariaLabel })}
        className={`${ELEVATED_PANEL_CLASS} ${surface.dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{
          gap: scale.gap,
          padding: scale.pad,
          borderRadius: scale.panelRadius,
          ...ELEVATED_PANEL_STYLE,
          ...CONTROL_FONT,
        }}
        // 面のどこを掴んでも動かせる。ボタンの上も含む（掴める余白は外周に数 px しか
        // 無いので、ボタンを避けると「掴んだのに動かない」が起きる）。
        onPointerDown={surface.onPointerDown}
        onClick={isolateEvents ? (event) => event.stopPropagation() : undefined}
        onKeyDown={isolateEvents ? (event) => event.stopPropagation() : undefined}
      >
        {/* 掴み手。面のどこでもドラッグの起点にはなるが、実際にはボタンが敷き詰められて
            いて掴める余白はほとんど無い。掴める場所がある、と分かる幅を確保する。 */}
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

        {children({ scale, consumeMoved: surface.consumeMoved })}

        <button
          type="button"
          onClick={() => {
            if (surface.consumeMoved()) return;
            setCollapsedAndPersist(true);
          }}
          aria-expanded={true}
          aria-label={collapseLabel}
          className={`${TOOL_BUTTON_CLASS} ${HOVER_CLASS}`}
          style={{
            height: scale.button,
            width: scale.button,
            borderRadius: scale.buttonRadius,
            color: 'var(--date-color)',
          }}
        >
          <ChevronIcon size={scale.icon} direction="down" />
        </button>
      </div>
    </div>
  );
}

function ChevronIcon({ size, direction }: { size: number; direction: 'up' | 'down' }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={ICON_STROKE_WIDTH}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: 'var(--date-color)' }}
    >
      <path d={direction === 'up' ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'} />
    </svg>
  );
}
