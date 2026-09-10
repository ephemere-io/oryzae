'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { startTransition } from 'react';
import { HelpHint } from '@/components/ui/help-hint';
import { Segmented } from '@/components/ui/segmented';
import { Select } from '@/components/ui/select';
import type { PaletteSize } from '@/components/ui/surface';
import { Switch } from '@/components/ui/switch';

type WritingMode = 'vertical' | 'horizontal';
type FontFamily = 'serif' | 'sans';
export type TimeInscriptionMode = 'fontSize' | 'fontWeight' | 'pressureBleed';
type GhostMode = 'block' | 'dust';

export interface EditorSettings {
  writingMode: WritingMode;
  fontFamily: FontFamily;
  fontSize: number;
  lineHeight: number;
  focusModeEnabled: boolean;
  /** 書いている間はアクションパレットを隠すか（既定 ON）。 */
  paletteAutoHide: boolean;
  /** アクションパレットの大きさ。画面の広さと目に依るので選べるようにしてある。 */
  paletteSize: PaletteSize;
  timeInscriptionEnabled: boolean;
  timeInscriptionMode: TimeInscriptionMode;
  eraserTraceEnabled: boolean;
  ampEnabled: boolean;
  ghostEnabled: boolean;
  ghostMode: GhostMode;
  ghostSize: number;
  ghostScatter: number;
  ghostBlurStart: number;
  ghostBlurEnd: number;
  ghostDuration: number;
}

export const DEFAULT_SETTINGS: EditorSettings = {
  writingMode: 'vertical',
  fontFamily: 'serif',
  fontSize: 32,
  lineHeight: 1.625,
  focusModeEnabled: true,
  paletteAutoHide: true,
  paletteSize: 'medium',
  timeInscriptionEnabled: false,
  timeInscriptionMode: 'fontSize',
  eraserTraceEnabled: false,
  ampEnabled: false,
  ghostEnabled: false,
  ghostMode: 'block',
  ghostSize: 100,
  ghostScatter: 30,
  ghostBlurStart: 4,
  ghostBlurEnd: 14,
  ghostDuration: 100,
};

interface SettingsPanelProps {
  settings: EditorSettings;
  onChange: (patch: Partial<EditorSettings>) => void;
  /** 打鍵音が鳴らせない理由。null なら黙っている。 */
  ampUnavailable?: 'denied' | 'unsupported' | null;
  /**
   * このエントリーを消す。**まだ保存されていないエントリーでは渡さない**
   * （消す対象が無いのに消す道だけあると、押した先で何も起きない）。
   */
  onDelete?: () => void;
}

function isTimeInscriptionMode(value: string): value is TimeInscriptionMode {
  return value === 'fontSize' || value === 'fontWeight' || value === 'pressureBleed';
}

function isPaletteSize(value: string): value is PaletteSize {
  return value === 'small' || value === 'medium' || value === 'large';
}

function isGhostMode(value: string): value is GhostMode {
  return value === 'block' || value === 'dust';
}

/**
 * セクション。見出しは**小さく薄い一行**で、区切り線は引かない。
 *
 * Notion の設定パネルと同じ考え方: 面を線で刻むのではなく、**余白の大小**で
 * まとまりを作る。セクション間は 28px、セクション内の行間は 6px。
 */
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col px-5 pb-7 last:pb-5">
      <div className="mb-2 flex h-5 items-center">
        <span className="text-[11px] font-medium tracking-[0.04em] text-[var(--fg)] opacity-45">
          {label}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">{children}</div>
    </section>
  );
}

/**
 * 「ラベル ⟷ コントロール」の1行。**パネル内の行はすべてこの形に揃える**
 * （以前はトグルが両端揃え・スライダーが左ラベル＋右数値・ラジオが縦積みとバラバラだった）。
 *
 * 行の高さは 36px で固定する。中身がトグルでもスライダーでも選択でも、
 * 目が同じ間隔で下りていけるようにする。
 */
function Row({ label, control, hint }: { label: string; control: React.ReactNode; hint?: string }) {
  return (
    <div className="flex h-9 items-center justify-between gap-4">
      <span className="flex shrink-0 items-center gap-1.5 text-[13px] text-[var(--fg)]">
        {label}
        {hint && <HelpHint subject={label} text={hint} />}
      </span>
      <div className="flex min-w-0 flex-1 justify-end">{control}</div>
    </div>
  );
}

/**
 * ある設定を ON にしたときだけ現れる、その設定の**中身**。
 *
 * 以前は親のトグルと同じ位置に並んでいたので、「ゴースト」を入れると出てくる5つの行が
 * ゴーストの一部なのか別の設定なのか分からなかった。左に線を引いて字下げし、
 * **親にぶら下がっている**ことを形で言う。
 */
function SubSettings({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="ml-1.5 flex flex-col gap-1.5 border-l pl-3"
      style={{ borderColor: 'var(--border-subtle)' }}
    >
      {children}
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
  hint,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  display: string;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <div className="flex h-9 items-center justify-between gap-4">
      <span className="flex shrink-0 items-center gap-1.5">
        <label htmlFor={id} className="text-[13px] text-[var(--fg)]">
          {label}
        </label>
        {hint && <HelpHint subject={label} text={hint} />}
      </span>
      <div className="flex min-w-0 flex-1 items-center justify-end gap-2.5">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-28 cursor-pointer accent-[var(--accent)]"
        />
        <span className="w-11 shrink-0 text-right text-[12px] tabular-nums text-[var(--date-color)]">
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
export function SettingsDrawer({
  settings,
  onChange,
  ampUnavailable = null,
  onDelete,
}: SettingsPanelProps) {
  const t = useTranslations('editor.settings');

  return (
    // 見出し（「設定」）は置かない。歯車を押して開いた面なので、何の面かは自明。
    // 上端の余白だけで始まりを示す。
    <div
      className="flex flex-col pt-4"
      style={{ fontFamily: 'Inter, "Noto Sans JP", sans-serif' }}
      {...verifyAttrs({
        unit: 'SettingsDrawer',
        timeInscriptionEnabled: settings.timeInscriptionEnabled,
        ghostEnabled: settings.ghostEnabled,
      })}
    >
      <Section label={t('section_display')}>
        {/* 縦か横か。2択なので開かせない（Segmented の doc を参照）。
            切り替えは**紙の組み直し**なので重い（本文全体の再レイアウト）。入力の応答を
            止めないよう、反映を transition に載せてブラウザに先に描かせる
            （実測: 切り替えのたびに 200ms 入力が詰まっていた）。 */}
        <Row
          label={t('writing_mode')}
          control={
            <Segmented
              className="w-40"
              ariaLabel={t('writing_mode')}
              value={settings.writingMode}
              options={[
                { value: 'vertical', label: t('writing_vertical') },
                { value: 'horizontal', label: t('writing_horizontal') },
              ]}
              onChange={(v) =>
                startTransition(() =>
                  onChange({ writingMode: v === 'horizontal' ? 'horizontal' : 'vertical' }),
                )
              }
            />
          }
        />
        <Row
          label={t('font_family')}
          control={
            <Segmented
              className="w-40"
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
        {/* 操作パレットを書いている間だけ隠すか。常に出しておきたい人のために切れる。 */}
        <Switch
          id="palette-auto-hide"
          label={t('palette_auto_hide')}
          checked={settings.paletteAutoHide}
          onChange={(v) => onChange({ paletteAutoHide: v })}
        />
        {/* パレットの大きさ。3段あるので面に畳む（2択なら Segmented）。 */}
        <Row
          label={t('palette_size')}
          control={
            <Select
              className="w-32"
              ariaLabel={t('palette_size')}
              value={settings.paletteSize}
              options={[
                { value: 'small', label: t('palette_size_small') },
                { value: 'medium', label: t('palette_size_medium') },
                { value: 'large', label: t('palette_size_large') },
              ]}
              onChange={(v) => {
                if (isPaletteSize(v)) onChange({ paletteSize: v });
              }}
            />
          }
        />
      </Section>

      <Section label={t('section_effects')}>
        {/* エフェクトは名前だけでは何が起きるか分からない（「時間内包」「音量内包」）。
            名前を長くすると行が窮屈になるので、知りたい人が触れば出る「？」を隣に置く。 */}
        <Switch
          id="time-inscription"
          label={t('time_inscription')}
          hint={t('time_inscription_hint')}
          checked={settings.timeInscriptionEnabled}
          onChange={(v) => onChange({ timeInscriptionEnabled: v })}
        />
        {/* ON にしたときだけ出る「表し方」は、時間内包の中身。字下げしてぶら下げる。 */}
        {settings.timeInscriptionEnabled && (
          <SubSettings>
            <Row
              label={t('time_inscription_mode')}
              hint={t('time_inscription_mode_hint')}
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
          </SubSettings>
        )}

        <Switch
          id="eraser-trace"
          label={t('eraser_trace')}
          hint={t('eraser_trace_hint')}
          checked={settings.eraserTraceEnabled}
          onChange={(v) => onChange({ eraserTraceEnabled: v })}
        />
        <Switch
          id="amp"
          label={t('amp')}
          hint={t('amp_hint')}
          checked={settings.ampEnabled}
          onChange={(v) => onChange({ ampEnabled: v })}
        />
        {/* **鳴らない理由は黙らない。** 以前はマイクを使えないと何も起きず、
            押した本人には壊れているのか仕様なのか分からなかった。 */}
        {settings.ampEnabled && ampUnavailable && (
          <SubSettings>
            <p role="status" className="py-1 text-[11px] leading-[1.7] text-[var(--date-color)]">
              {ampUnavailable === 'denied' ? t('amp_denied') : t('amp_unsupported')}
            </p>
          </SubSettings>
        )}
        {/* 「音量内包」のトグルはここに置かない。
            **どこからも読まれていない死んだスイッチだった**（押しても何も起きない）。
            声で字の大きさが変わる効果そのものは、パレットのマイクが持っている——
            書いている最中に入り切りするものなので、設定の面ではなく手元にある方がよい。 */}
        <Switch
          id="ghost"
          label={t('ghost')}
          hint={t('ghost_hint')}
          checked={settings.ghostEnabled}
          onChange={(v) => onChange({ ghostEnabled: v })}
        />
        {/* ON にしたときだけ出る5つの行は、ゴーストの中身。字下げしてぶら下げる。 */}
        {settings.ghostEnabled && (
          <SubSettings>
            <Row
              label={t('ghost_mode')}
              control={
                <Segmented
                  className="w-36"
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
              min={50}
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
              display={`${settings.ghostScatter}`}
              onChange={(v) => onChange({ ghostScatter: v })}
            />
            <SliderRow
              id="ghost-blur-start"
              label={t('ghost_blur_start')}
              value={settings.ghostBlurStart}
              min={0}
              max={20}
              display={`${settings.ghostBlurStart}`}
              onChange={(v) => onChange({ ghostBlurStart: v })}
            />
            <SliderRow
              id="ghost-blur-end"
              label={t('ghost_blur_end')}
              value={settings.ghostBlurEnd}
              min={0}
              max={40}
              display={`${settings.ghostBlurEnd}`}
              onChange={(v) => onChange({ ghostBlurEnd: v })}
            />
            <SliderRow
              id="ghost-duration"
              label={t('ghost_duration')}
              value={settings.ghostDuration}
              min={20}
              max={400}
              step={10}
              display={`${settings.ghostDuration}`}
              onChange={(v) => onChange({ ghostDuration: v })}
            />
          </SubSettings>
        )}
      </Section>

      {/* このエントリーを消す。
          **一覧まで戻らないと消せなかった。** 書いている本人が「これは残さない」と
          決めるのは書いている最中なので、その場に道を置く。
          消すのは戻せないので、**他の設定とは離して最後に置き、色でも言い分ける**
          （並びの途中に赤い行があると、隣を押すつもりで当たる）。 */}
      {onDelete && (
        <div
          className="mt-1 border-t px-5 pt-4 pb-5"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <button
            type="button"
            onClick={onDelete}
            className="flex h-8 w-full items-center rounded-md px-2 text-left text-[13px] text-red-500 transition-colors hover:bg-[var(--hover-wash)]"
          >
            {t('delete_entry')}
          </button>
        </div>
      )}
    </div>
  );
}
