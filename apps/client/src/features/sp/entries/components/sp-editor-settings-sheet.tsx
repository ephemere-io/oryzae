'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { type DockDetent, DockSheet } from '@/components/ui/dock-sheet';
import { TrashIcon } from '@/components/ui/palette-icons';
import { Segmented } from '@/components/ui/segmented';
import { CONTROL_FONT } from '@/components/ui/surface';
import type {
  EditorDisplay,
  EditorFontFamily,
  EditorScale,
  EditorSpacing,
} from '@/features/shared/entries/types';

interface SpEditorSettingsSheetProps {
  open: boolean;
  display: EditorDisplay;
  onChange: (patch: Partial<EditorDisplay>) => void;
  onClose: () => void;
  /**
   * このエントリーを削除する（確認は呼び出し側）。無ければ行を出さない（まだ保存されていない新規）。
   *
   * 削除をここに置く理由: パレットは書いている最中に何度も押す手（写真・漬け込む）の席で、
   * 同じ列に取り返しのつかない操作を並べると指の癖で押してしまう。Notion のモバイルは右上の
   * 「…」の中、iOS の設定画面はシートの末尾に赤字で離して置く。この画面の右上は「この画面の設定」
   * なので、その末尾に離して置く（オーナーの指摘: パレットから消せるのはどうか）。
   */
  onDelete?: () => void;
}

function toFontFamily(value: string): EditorFontFamily {
  return value === 'sans' ? 'sans' : 'serif';
}
function toScale(value: string): EditorScale {
  return value === 'small' || value === 'large' ? value : 'medium';
}
function toSpacing(value: string): EditorSpacing {
  return value === 'tight' || value === 'wide' ? value : 'normal';
}

/**
 * エディタの設定（SP）。上段の右端の歯車から開く。
 *
 * **非モーダルのドック**（`DockSheet`、半分と全画面）。暗転しないので、段を押した結果
 * （行間・文字サイズ・書体）が上の本文でそのまま見える（実機レビュー: 設定を変えたらこうなる、を
 * 確かめたい）。行は「ラベル + 段」を横に並べて低くし、本文が見える面積を残す。
 * 下へ引くか「閉じる」で閉じる。
 *
 * 出すのは**本文の見た目**だけ: 書体・文字サイズ・行間・字間。PC の設定にあるエフェクト
 * （消し跡・圧力にじみ）はポインタ前提で指では成立しないので出さない。
 */
export function SpEditorSettingsSheet({
  open,
  display,
  onChange,
  onClose,
  onDelete,
}: SpEditorSettingsSheetProps) {
  const t = useTranslations('sp.editor');
  const tPc = useTranslations('editor.settings');
  const [detent, setDetent] = useState<DockDetent>('half');
  useEffect(() => {
    if (open) setDetent('half');
  }, [open]);

  return (
    <DockSheet
      open={open}
      detent={detent}
      // 半分で開き（上の本文で変化が見える）、持ち上げれば全画面。中身の高さの段だけにしていた頃は、
      // 下げると閉じるしかなく、半分に置けなかった（実機レビュー）。
      detents={['half', 'full']}
      onDetentChange={setDetent}
      dismissible
      onClose={onClose}
      ariaLabel={t('settings_title')}
    >
      <div
        {...verifyAttrs({
          unit: 'SpEditorSettingsSheet',
          fontFamily: display.fontFamily,
          fontSize: display.fontSize,
          lineHeight: display.lineHeight,
          letterSpacing: display.letterSpacing,
          canDelete: onDelete !== undefined,
        })}
        className="flex flex-col gap-3"
        style={CONTROL_FONT}
      >
        <div className="flex items-center justify-between gap-3">
          <span
            className="text-[11px] uppercase tracking-[0.14em]"
            style={{ color: 'var(--accent)' }}
          >
            {t('settings_title')}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] shrink-0 rounded-full border px-4 text-[13px]"
            style={{ color: 'var(--fg)', borderColor: 'var(--border-subtle)' }}
          >
            {t('close')}
          </button>
        </div>
        <Row label={tPc('font_family')}>
          <Segmented
            size="md"
            ariaLabel={tPc('font_family')}
            value={display.fontFamily}
            onChange={(value) => onChange({ fontFamily: toFontFamily(value) })}
            options={[
              { value: 'serif', label: tPc('font_serif') },
              { value: 'sans', label: tPc('font_sans') },
            ]}
          />
        </Row>
        <Row label={tPc('font_size')}>
          <Segmented
            size="md"
            ariaLabel={tPc('font_size')}
            value={display.fontSize}
            onChange={(value) => onChange({ fontSize: toScale(value) })}
            options={[
              { value: 'small', label: t('settings_size_small') },
              { value: 'medium', label: t('settings_size_medium') },
              { value: 'large', label: t('settings_size_large') },
            ]}
          />
        </Row>
        <Row label={tPc('line_height')}>
          <Segmented
            size="md"
            ariaLabel={tPc('line_height')}
            value={display.lineHeight}
            onChange={(value) => onChange({ lineHeight: toSpacing(value) })}
            options={spacingOptions(t)}
          />
        </Row>
        <Row label={t('settings_letter_spacing')}>
          <Segmented
            size="md"
            ariaLabel={t('settings_letter_spacing')}
            value={display.letterSpacing}
            onChange={(value) => onChange({ letterSpacing: toSpacing(value) })}
            options={spacingOptions(t)}
          />
        </Row>
        {onDelete ? (
          // 破壊的な操作は設定から離して末尾に（iOS の設定画面の作法）。押すと確認シートへ。
          <div className="mt-2 border-t pt-4" style={{ borderColor: 'var(--border-subtle)' }}>
            <DangerButton onClick={onDelete} label={t('settings_delete_entry')} />
          </div>
        ) : null}
      </div>
    </DockSheet>
  );
}

function spacingOptions(t: ReturnType<typeof useTranslations<'sp.editor'>>) {
  return [
    { value: 'tight', label: t('settings_spacing_tight') },
    { value: 'normal', label: t('settings_spacing_normal') },
    { value: 'wide', label: t('settings_spacing_wide') },
  ];
}

/** ラベルと段を横に並べる（行を低くして、上の本文が見える面積を残す）。 */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 shrink-0 text-[12px]" style={{ color: 'var(--date-color)' }}>
        {label}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/**
 * 取り返しのつかない操作のボタン（エントリーの削除）。赤い 1 行の文字だけでは押せるものに見えなかった
 * （実機レビュー）。淡い赤の面・枠・ゴミ箱のアイコン・全幅で「押せる、けれど重い」と伝える。PC の設定の
 * 引き出しも同じ見た目（`pc/entries/components/settings-drawer.tsx`）。
 */
function DangerButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-settings-delete
      className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border text-[15px] font-medium"
      style={{
        color: 'var(--ob-jar-warm)',
        borderColor: 'color-mix(in srgb, var(--ob-jar-warm) 35%, transparent)',
        background: 'color-mix(in srgb, var(--ob-jar-warm) 8%, transparent)',
      }}
    >
      <TrashIcon />
      {label}
    </button>
  );
}
