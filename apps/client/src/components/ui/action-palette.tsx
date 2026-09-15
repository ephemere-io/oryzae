'use client';

import { verifyAttrs } from '@oryzae/verify';
import { type ReactNode, useState } from 'react';
import { KeyboardDownIcon } from './palette-icons';
import { CONTROL_FONT } from './surface';

export interface PaletteAction {
  /** 検証と読み上げの手掛かり（`data-palette-action`）。画面の中で一意に。 */
  id: string;
  /** 読み上げに出す正式な名前。 */
  label: string;
  /** 目に見える短い名前。無ければ `label`。 */
  caption?: string;
  icon: ReactNode;
  /** 押したとき。`file` の操作では、選び手を開く直前に呼ぶ。 */
  onSelect: () => void;
  /**
   * 押すと端末の写真・ファイルの選び手を開く。**押した指がそのままボタンの上の `<input type="file">` に
   * 当たる**ようにする。iOS は「写真ライブラリ／写真を撮る／ファイルを選択」のメニューを input の位置に
   * 出すので、隠した input を JS で叩くと、input の居る場所（画面の上のほう）にメニューが浮いた（実機
   * レビュー）。ボタンと同じ箱に input を重ねれば、メニューはボタンから出る。
   */
  file?: { accept: string; onFile: (file: File) => void };
  /** 押せない理由。あれば押せない（半透明）。押すと理由がパレットの上に出る（読み上げにも添える）。 */
  disabledReason?: string;
  /**
   * いま効いている状態。**色だけで言う**（アクセントの色）。右上に点も添えていたが、色と点の 2 段で
   * 重みを付けることになり、押したあとに謎の点が出るように見えた（オーナーの指示）。押せない状態は
   * `disabledReason` の半透明で言う（「漬けてある」は色 + 半透明）。
   */
  active?: boolean;
  /** 送信中など、一時的に押せない。 */
  busy?: boolean;
  tone?: 'normal' | 'danger';
}

interface ActionPaletteProps {
  actions: PaletteAction[];
  ariaLabel: string;
  /**
   * キーボードが出ているか。出ていれば右端に「キーボードを閉じる」を置き、
   * 下端の安全領域の余白は取らない（キーボードの真上に付くので）。
   */
  keyboardOpen?: boolean;
  dismissKeyboardLabel?: string;
}

/** 列の高さ（px）。安全領域の余白は別に足す。 */
const ACTION_PALETTE_HEIGHT = 56;

/**
 * 画面の下端の操作の列。**エントリー・ボード・瓶で同じ部品**、中身だけが違う。
 *
 * 置き場は流れの中（SP の殻の下端）。殻がビジュアルビューポートに追従するので、
 * キーボードが出ればこの列はキーボードの真上に来る（Notion のモバイルのキーボード
 * ツールバーと同じ席）。`fixed` で置かないのは、iOS でキャレットを見せるスクロールが
 * 走るとレイアウトビューポート基準の `fixed` が本文の下へ潜るため（実機で報告）。
 *
 * アイコンに短い名前を添える。SP にはホバーが無く、名前を隠す手が無い。
 */
export function ActionPalette({
  actions,
  ariaLabel,
  keyboardOpen = false,
  dismissKeyboardLabel,
}: ActionPaletteProps) {
  /**
   * 押せない操作を押したときに出す理由（パレットの上に 1 行）。以前は理由を読み上げにしか持たず、押しても
   * 何も起きなかった（実機レビュー: 押したときに分かるように）。出てしばらくして消える（CSS の animation の
   * 終わりで消す）。同じ操作を続けて押しても出し直せるよう、押した回数を鍵にする。
   */
  const [hint, setHint] = useState<{ text: string; count: number } | null>(null);
  const showHint = (text: string) =>
    setHint((previous) => ({ text, count: (previous?.count ?? 0) + 1 }));

  return (
    <div
      {...verifyAttrs({
        unit: 'ActionPalette',
        actionCount: actions.length,
        keyboardOpen,
        hint: hint !== null,
      })}
      role="toolbar"
      aria-label={ariaLabel}
      className="relative flex shrink-0 items-stretch gap-1 px-2"
      style={{
        ...CONTROL_FONT,
        height: ACTION_PALETTE_HEIGHT,
        boxSizing: 'content-box',
        // キーボードが無いときはホームインジケータの上に載る。
        paddingBottom: keyboardOpen ? 0 : 'env(safe-area-inset-bottom, 0px)',
        background: 'var(--surface-raised)',
        borderTop: '1px solid var(--surface-raised-border)',
      }}
    >
      {hint ? (
        <p
          key={hint.count}
          role="status"
          data-palette-hint
          className="oz-palette-hint pointer-events-none absolute bottom-full left-1/2 z-[25] mb-2 w-max max-w-[calc(100%-1rem)] rounded-full px-3.5 py-2 text-center text-[12px] leading-snug"
          style={{ background: 'var(--fg)', color: 'var(--bg)' }}
          onAnimationEnd={() => setHint(null)}
        >
          {hint.text}
        </p>
      ) : null}
      {actions.map((action) => {
        const disabled = Boolean(action.disabledReason) || Boolean(action.busy);
        const { file } = action;
        // 押せない写真の操作はふつうのボタンとして描く（押せば理由が出る。input は指を受けてしまう）。
        if (file && !disabled) {
          return (
            <div
              key={action.id}
              data-palette-action={action.id}
              className="relative flex min-w-[60px] flex-col items-center justify-center gap-1 whitespace-nowrap rounded-xl px-2 transition-colors hover:bg-[var(--hover-wash)] has-[:active]:scale-95"
              style={{ color: 'var(--fg)' }}
            >
              {action.icon}
              <span aria-hidden="true" className="text-[10px] leading-none tracking-[0.04em]">
                {action.caption ?? action.label}
              </span>
              <input
                type="file"
                accept={file.accept}
                aria-label={action.label}
                data-palette-file
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                onClick={() => {
                  setHint(null);
                  action.onSelect();
                }}
                onChange={(event) => {
                  const picked = event.target.files?.[0];
                  // 同じファイルを選び直しても change が起きるよう毎回空にする。
                  event.target.value = '';
                  if (picked) file.onFile(picked);
                }}
              />
            </div>
          );
        }
        return (
          <button
            key={action.id}
            type="button"
            aria-label={
              action.disabledReason ? `${action.label}（${action.disabledReason}）` : action.label
            }
            aria-disabled={disabled}
            data-palette-action={action.id}
            onClick={() => {
              if (action.disabledReason) {
                showHint(action.disabledReason);
                return;
              }
              if (disabled) return;
              setHint(null);
              action.onSelect();
            }}
            // 押しても本文のフォーカスを落とさない（キーボードが一度引っ込んでまた出る、をやめる）。
            onPointerDown={(event) => event.preventDefault()}
            onMouseDown={(event) => event.preventDefault()}
            className={`relative flex min-w-[60px] flex-col items-center justify-center gap-1 whitespace-nowrap rounded-xl px-2 transition-colors active:scale-95 ${
              disabled ? 'opacity-40' : 'hover:bg-[var(--hover-wash)]'
            }`}
            style={{
              color:
                action.tone === 'danger'
                  ? 'var(--ob-jar-warm)'
                  : action.active
                    ? 'var(--accent)'
                    : 'var(--fg)',
            }}
          >
            {action.busy ? (
              <span
                className="inline-block h-[22px] w-[22px] animate-spin rounded-full border-2 border-current border-t-transparent"
                aria-hidden="true"
              />
            ) : (
              action.icon
            )}
            <span className="text-[10px] leading-none tracking-[0.04em]">
              {action.caption ?? action.label}
            </span>
          </button>
        );
      })}

      <span className="flex-1" />

      {keyboardOpen && dismissKeyboardLabel ? (
        <button
          type="button"
          aria-label={dismissKeyboardLabel}
          data-palette-action="dismiss-keyboard"
          onClick={() => {
            if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
          }}
          className="flex w-14 items-center justify-center rounded-xl transition-colors hover:bg-[var(--hover-wash)] active:scale-95"
          style={{ color: 'var(--date-color)' }}
        >
          <KeyboardDownIcon />
        </button>
      ) : null}
    </div>
  );
}
