'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { BottomSheet } from '@/components/ui/bottom-sheet';
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
 * 出すのは**本文の見た目**だけ: 書体・文字サイズ・行間・字間。PC の設定にあるエフェクト
 * （消し跡・圧力にじみ）はポインタ前提で指では成立しないので出さない。打鍵の間や声で
 * 変わるもの（時間内包・音量内包）は SP でも成立しうるが、没入の補助として PC で
 * 育てたものなので、SP に出すかはオーナーの判断待ち（作業指示 B6）。
 *
 * 以前の右端の歯車は**アカウント画面**に飛んでいた。設定は画面ごとに違うものなので、
 * 画面が自分の設定を右端に差し込む（`useSpChrome().actionSlot`）。
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

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      ariaLabel={t('settings_title')}
      label={t('settings_title')}
      closeLabel={t('close')}
      // 中身の高さで止まる（4 段の設定と削除で 6 割ほど）。それ以上に開かず、下へ引けば閉じる。
      detents={['content']}
      initialDetent={0}
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
        className="flex flex-col gap-5 pt-2"
        style={CONTROL_FONT}
      >
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
          <div
            className="mt-3 flex flex-col gap-1 border-t pt-4"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <button
              type="button"
              onClick={onDelete}
              data-settings-delete
              className="min-h-[44px] w-full rounded-xl text-left text-[15px]"
              style={{ color: 'var(--ob-jar-warm)' }}
            >
              {t('settings_delete_entry')}
            </button>
            <span className="text-[12px]" style={{ color: 'var(--date-color)' }}>
              {t('settings_delete_hint')}
            </span>
          </div>
        ) : null}
      </div>
    </BottomSheet>
  );
}

function spacingOptions(t: ReturnType<typeof useTranslations<'sp.editor'>>) {
  return [
    { value: 'tight', label: t('settings_spacing_tight') },
    { value: 'normal', label: t('settings_spacing_normal') },
    { value: 'wide', label: t('settings_spacing_wide') },
  ];
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[12px]" style={{ color: 'var(--date-color)' }}>
        {label}
      </span>
      {children}
    </div>
  );
}
