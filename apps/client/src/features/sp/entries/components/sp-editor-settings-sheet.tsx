'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ActionRow } from '@/components/ui/action-row';
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
 * 出す／消すは上段の歯車と「閉じる」。指でシートを下げても消えない（高さだけ。実機レビュー）。
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
  // 開くたびに半分から（開いた描画のうちに戻す）。
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setDetent('half');
  }

  return (
    <DockSheet
      open={open}
      detent={detent}
      // 半分で開き（上の本文で変化が見える）、持ち上げれば全画面。中身の高さの段だけにしていた頃は、
      // 下げると閉じるしかなく、半分に置けなかった（実機レビュー）。
      detents={['half', 'full']}
      onDetentChange={setDetent}
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
        <span
          className="text-[11px] uppercase tracking-[0.14em]"
          style={{ color: 'var(--accent)' }}
        >
          {t('settings_title')}
        </span>
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
        {/* 操作は末尾の 1 行に固める（問いの編集のシートと同じ並び。左上中心主義: 左に「閉じる」、押されたくない
            「削除」は右端）。削除は本文の見た目の段から離す（iOS の設定画面の作法）。押すと確認シートへ。 */}
        <div className="mt-2 border-t pt-4" style={{ borderColor: 'var(--border-subtle)' }}>
          <ActionRow
            actions={[
              { id: 'close', label: t('close'), tone: 'secondary', onSelect: onClose },
              ...(onDelete
                ? [
                    {
                      id: 'delete-entry',
                      label: t('settings_delete_entry'),
                      tone: 'danger' as const,
                      icon: <TrashIcon />,
                      onSelect: onDelete,
                    },
                  ]
                : []),
            ]}
          />
        </div>
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
