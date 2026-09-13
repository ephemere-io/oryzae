'use client';

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useVisualViewport, type VisualViewportBox } from './visual-viewport';

/** 上段の中央に出す短い状態。文字と色味だけ（ノードを渡すと毎描画で入れ替わってしまう）。 */
export interface SpChromeStatus {
  text: string;
  tone: 'ok' | 'saving' | 'error';
}

interface SpChromeValue {
  /** 上段（Provider）の中に居るか。居なければ画面が自前の戻るを出す（孤立検証・テスト）。 */
  mounted: boolean;
  /**
   * 上段の「戻る」を横取りする手。`null` なら書斎（/）へ。
   *
   * 瓶の中で問いを開いているときは、戻るはまず問いの画面を閉じる、というように、
   * 開いている画面が「戻る」の意味をその場で決める。
   */
  back: (() => void) | null;
  setBack: (handler: (() => void) | null) => void;
  status: SpChromeStatus | null;
  setStatus: (status: SpChromeStatus | null) => void;
  /**
   * 下端の操作の列（パレット）の席。画面はここへ `createPortal` で差し込む。
   * 席が無ければ（Provider の外・孤立検証）画面が自分の中に描く。
   */
  paletteSlot: HTMLElement | null;
  setPaletteSlot: (element: HTMLElement | null) => void;
  /** 殻が追従しているビジュアルビューポート。測れるまで null。 */
  viewport: VisualViewportBox | null;
  /** ソフトキーボードが出ているか（パレットの「閉じる」の出し入れに使う）。 */
  keyboardOpen: boolean;
}

const SpChromeContext = createContext<SpChromeValue>({
  mounted: false,
  back: null,
  setBack: () => {},
  status: null,
  setStatus: () => {},
  paletteSlot: null,
  setPaletteSlot: () => {},
  viewport: null,
  keyboardOpen: false,
});

/**
 * SP の上段（戻る・状態・設定）に、画面の側から口を出すための箱。
 *
 * `lib` に置くのは、上段の部品（`features/sp/navigation`）と口を出す画面（`features/sp/entries`
 * 等）が別のドメインで、互いを import できないため。ドメインの知識は持たない。
 */
export function SpChromeProvider({ children }: { children: React.ReactNode }) {
  const [back, setBackState] = useState<(() => void) | null>(null);
  const [status, setStatus] = useState<SpChromeStatus | null>(null);
  const [paletteSlot, setPaletteSlot] = useState<HTMLElement | null>(null);
  const viewport = useVisualViewport();

  // 関数を state に入れるときは updater と取り違えないよう包む。
  const setBack = useCallback((handler: (() => void) | null) => {
    setBackState(() => handler);
  }, []);

  const value = useMemo(
    () => ({
      mounted: true,
      back,
      setBack,
      status,
      setStatus,
      paletteSlot,
      setPaletteSlot,
      viewport,
      keyboardOpen: viewport?.keyboardOpen ?? false,
    }),
    [back, setBack, status, paletteSlot, viewport],
  );
  return <SpChromeContext.Provider value={value}>{children}</SpChromeContext.Provider>;
}

export function useSpChrome(): SpChromeValue {
  return useContext(SpChromeContext);
}

/**
 * 下端の操作の列を殻の席へ置く。席が無ければ（Provider の外・孤立検証）その場に描く。
 *
 * portal にするのは、列の中身（状態・押したときの手）を画面が持ったまま、描く場所だけを
 * 殻の下端に移すため。state で殻へ渡すと、毎描画で作り直される要素が state を揺らし続ける。
 */
export function placePalette(palette: ReactNode, slot: HTMLElement | null): ReactNode {
  return slot ? createPortal(palette, slot) : palette;
}

/** 画面が出ている間だけ「戻る」を横取りする。`null` を渡せば横取りしない。 */
export function useSpBackHandler(handler: (() => void) | null): void {
  const { setBack } = useSpChrome();
  useEffect(() => {
    setBack(handler);
    return () => setBack(null);
  }, [handler, setBack]);
}

/** 画面が出ている間、上段の中央に状態を出す。空文字なら何も出さない。 */
export function useSpStatus(text: string, tone: SpChromeStatus['tone']): void {
  const { setStatus } = useSpChrome();
  useEffect(() => {
    setStatus(text ? { text, tone } : null);
    return () => setStatus(null);
  }, [text, tone, setStatus]);
}
