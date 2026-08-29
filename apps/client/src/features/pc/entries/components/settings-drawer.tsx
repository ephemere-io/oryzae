'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { HelpTooltip } from '@/components/ui/tooltip';

type WritingMode = 'vertical' | 'horizontal';
type FontFamily = 'serif' | 'sans';
export type TimeInscriptionMode = 'fontSize' | 'fontWeight' | 'pressureBleed';
type GhostMode = 'block' | 'dust';

/**
 * 新規エントリで問いを紐付けたとき、その問いの発酵結果を出すかどうかの既定挙動。
 * 'ask' は毎回モーダルで確認、'always' は自動表示、'never' は表示しない。
 *
 * Issue #329 で「エディタ上へのフローティング表示」として入り、Issue #466 で
 * 右サイドバーへの集約に変わった。**型名と localStorage キーに Overlay が残っているのは
 * 履歴上の理由**（キーを変えると既存ユーザーの選択が失われる）。挙動はサイドバーの開閉。
 */
export type FermentationOverlayPreference = 'ask' | 'always' | 'never';

export interface EditorSettings {
  writingMode: WritingMode;
  fontFamily: FontFamily;
  fontSize: number;
  lineHeight: number;
  focusModeEnabled: boolean;
  timeInscriptionEnabled: boolean;
  timeInscriptionMode: TimeInscriptionMode;
  eraserTraceEnabled: boolean;
  ampEnabled: boolean;
  voiceEnabled: boolean;
  ghostEnabled: boolean;
  ghostMode: GhostMode;
  ghostSize: number;
  ghostScatter: number;
  ghostBlurStart: number;
  ghostBlurEnd: number;
  ghostDuration: number;
  fermentationOverlayPreference: FermentationOverlayPreference;
}

export const DEFAULT_SETTINGS: EditorSettings = {
  writingMode: 'vertical',
  fontFamily: 'serif',
  fontSize: 32,
  lineHeight: 1.625,
  focusModeEnabled: true,
  timeInscriptionEnabled: false,
  timeInscriptionMode: 'fontSize',
  eraserTraceEnabled: false,
  ampEnabled: false,
  voiceEnabled: false,
  ghostEnabled: false,
  ghostMode: 'block',
  ghostSize: 100,
  ghostScatter: 30,
  ghostBlurStart: 4,
  ghostBlurEnd: 14,
  ghostDuration: 100,
  fermentationOverlayPreference: 'ask',
};

interface SettingsPanelProps {
  settings: EditorSettings;
  onChange: (patch: Partial<EditorSettings>) => void;
}

function isTimeInscriptionMode(value: string): value is TimeInscriptionMode {
  return value === 'fontSize' || value === 'fontWeight' || value === 'pressureBleed';
}

function isGhostMode(value: string): value is GhostMode {
  return value === 'block' || value === 'dust';
}

function isFermentationPreference(value: string): value is FermentationOverlayPreference {
  return value === 'ask' || value === 'always' || value === 'never';
}

/** 見出し。パネル内のセクションはすべてこの形で始める。 */
function Section({
  label,
  help,
  children,
}: {
  label: string;
  help?: { content: string; ariaLabel: string };
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-1 border-t border-[var(--border-subtle)] px-4 py-3 first:border-t-0">
      <div className="mb-0.5 flex items-center gap-1.5">
        {/* 見出しは本文より一段落とすが、読めなくなるほど落とさない（--date-color は薄すぎた）。 */}
        <span className="text-[10px] font-semibold tracking-[0.16em] text-[var(--fg)] opacity-55">
          {label}
        </span>
        {help && <HelpTooltip content={help.content} ariaLabel={help.ariaLabel} />}
      </div>
      {children}
    </section>
  );
}

/**
 * 「ラベル ⟷ コントロール」の1行。**パネル内の行はすべてこの形に揃える**
 * （以前はトグルが両端揃え・スライダーが左ラベル＋右数値・ラジオが縦積みとバラバラだった）。
 */
function Row({ label, control }: { label: string; control: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="shrink-0 text-xs text-[var(--fg)]">{label}</span>
      <div className="flex min-w-0 flex-1 justify-end">{control}</div>
    </div>
  );
}

function SliderRow({
  id,
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  display: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <label htmlFor={id} className="shrink-0 text-xs text-[var(--fg)]">
        {label}
      </label>
      <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-28 accent-[var(--accent)]"
        />
        <span className="w-12 shrink-0 text-right text-[11px] tabular-nums text-[var(--date-color)]">
          {display}
        </span>
      </div>
    </div>
  );
}

/**
 * エディタの設定パネル。
 *
 * 以前は画面を覆うドロワー（背景をグレーアウトする左側の板）だった。書いている最中に
 * 設定を触ると本文が暗転して作業が切れるため、**設定ボタンの真下に開く軽いパネル**に変えた。
 * 外側をクリックすれば閉じる。開閉と位置決めは呼び出し側の `Popover` が持つ。
 *
 * **エクスポート名が SettingsDrawer のままなのは履歴上の理由**（この型ファイルから
 * EditorSettings / DEFAULT_SETTINGS も出ており、参照箇所が広い）。中身はパネル。
 */
export function SettingsDrawer({ settings, onChange }: SettingsPanelProps) {
  const t = useTranslations('editor.settings');

  return (
    <div
      className="flex flex-col pb-1"
      {...verifyAttrs({
        unit: 'SettingsDrawer',
        timeInscriptionEnabled: settings.timeInscriptionEnabled,
        ghostEnabled: settings.ghostEnabled,
        fermentationOverlayPreference: settings.fermentationOverlayPreference,
      })}
    >
      <div className="px-4 pt-3.5 pb-1">
        <h2 className="text-sm font-bold text-[var(--fg)]">{t('heading')}</h2>
      </div>

      <Section label={t('section_display')}>
        <Row
          label={t('writing_mode')}
          control={
            <Select
              className="w-32"
              ariaLabel={t('writing_mode')}
              value={settings.writingMode}
              options={[
                { value: 'vertical', label: t('writing_vertical') },
                { value: 'horizontal', label: t('writing_horizontal') },
              ]}
              onChange={(v) =>
                onChange({ writingMode: v === 'horizontal' ? 'horizontal' : 'vertical' })
              }
            />
          }
        />
        <Row
          label={t('font_family')}
          control={
            <Select
              className="w-32"
              ariaLabel={t('font_family')}
              value={settings.fontFamily}
              options={[
                { value: 'serif', label: t('font_serif') },
                { value: 'sans', label: t('font_sans') },
              ]}
              onChange={(v) => onChange({ fontFamily: v === 'sans' ? 'sans' : 'serif' })}
            />
          }
        />
        <SliderRow
          id="font-size"
          label={t('font_size')}
          value={settings.fontSize}
          min={14}
          max={48}
          display={`${settings.fontSize}px`}
          onChange={(v) => onChange({ fontSize: v })}
        />
        <SliderRow
          id="line-height"
          label={t('line_height')}
          value={settings.lineHeight}
          min={1.0}
          max={2.5}
          step={0.05}
          display={settings.lineHeight.toFixed(2)}
          onChange={(v) => onChange({ lineHeight: v })}
        />
        <Switch
          id="focus-mode"
          label={t('focus_mode')}
          checked={settings.focusModeEnabled}
          onChange={(v) => onChange({ focusModeEnabled: v })}
        />
      </Section>

      <Section label={t('section_effects')}>
        <Switch
          id="time-inscription"
          label={t('time_inscription')}
          checked={settings.timeInscriptionEnabled}
          onChange={(v) => onChange({ timeInscriptionEnabled: v })}
        />
        {settings.timeInscriptionEnabled && (
          <Row
            label={t('time_inscription_mode')}
            control={
              <Select
                className="w-36"
                ariaLabel={t('time_inscription_mode')}
                value={settings.timeInscriptionMode}
                options={[
                  { value: 'fontSize', label: t('ti_font_size') },
                  { value: 'fontWeight', label: t('ti_font_weight') },
                  { value: 'pressureBleed', label: t('ti_pressure_bleed') },
                ]}
                onChange={(v) => {
                  if (isTimeInscriptionMode(v)) onChange({ timeInscriptionMode: v });
                }}
              />
            }
          />
        )}

        <Switch
          id="eraser-trace"
          label={t('eraser_trace')}
          checked={settings.eraserTraceEnabled}
          onChange={(v) => onChange({ eraserTraceEnabled: v })}
        />
        <Switch
          id="amp"
          label={t('amp')}
          checked={settings.ampEnabled}
          onChange={(v) => onChange({ ampEnabled: v })}
        />
        <Switch
          id="voice"
          label={t('voice')}
          checked={settings.voiceEnabled}
          onChange={(v) => onChange({ voiceEnabled: v })}
        />
        <Switch
          id="ghost"
          label={t('ghost')}
          checked={settings.ghostEnabled}
          onChange={(v) => onChange({ ghostEnabled: v })}
        />
        {settings.ghostEnabled && (
          <>
            <Row
              label={t('ghost_mode')}
              control={
                <Select
                  className="w-32"
                  ariaLabel={t('ghost_mode')}
                  value={settings.ghostMode}
                  options={[
                    { value: 'block', label: t('ghost_block') },
                    { value: 'dust', label: t('ghost_dust') },
                  ]}
                  onChange={(v) => {
                    if (isGhostMode(v)) onChange({ ghostMode: v });
                  }}
                />
              }
            />
            <SliderRow
              id="ghost-size"
              label={t('ghost_size')}
              value={settings.ghostSize}
              min={20}
              max={200}
              display={`${settings.ghostSize}%`}
              onChange={(v) => onChange({ ghostSize: v })}
            />
            <SliderRow
              id="ghost-scatter"
              label={t('ghost_scatter')}
              value={settings.ghostScatter}
              min={0}
              max={100}
              display={`${settings.ghostScatter}%`}
              onChange={(v) => onChange({ ghostScatter: v })}
            />
            <SliderRow
              id="ghost-blur-start"
              label={t('ghost_blur_start')}
              value={settings.ghostBlurStart}
              min={0}
              max={20}
              step={0.5}
              display={`${settings.ghostBlurStart.toFixed(1)}px`}
              onChange={(v) => onChange({ ghostBlurStart: v })}
            />
            <SliderRow
              id="ghost-blur-end"
              label={t('ghost_blur_end')}
              value={settings.ghostBlurEnd}
              min={2}
              max={40}
              step={0.5}
              display={`${settings.ghostBlurEnd}px`}
              onChange={(v) => onChange({ ghostBlurEnd: v })}
            />
            <SliderRow
              id="ghost-duration"
              label={t('ghost_duration')}
              value={settings.ghostDuration}
              min={30}
              max={250}
              display={`${settings.ghostDuration}%`}
              onChange={(v) => onChange({ ghostDuration: v })}
            />
          </>
        )}
      </Section>

      <Section
        label={t('section_fermentation_overlay')}
        help={{
          content: t('fermentation_overlay_description'),
          ariaLabel: t('fermentation_overlay_help_aria'),
        }}
      >
        <Row
          label={t('fermentation_overlay_label')}
          control={
            <Select
              className="w-40"
              ariaLabel={t('fermentation_overlay_label')}
              value={settings.fermentationOverlayPreference}
              options={[
                { value: 'ask', label: t('fermentation_overlay_ask') },
                { value: 'always', label: t('fermentation_overlay_always') },
                { value: 'never', label: t('fermentation_overlay_never') },
              ]}
              onChange={(v) => {
                if (isFermentationPreference(v)) onChange({ fermentationOverlayPreference: v });
              }}
            />
          }
        />
      </Section>
    </div>
  );
}
