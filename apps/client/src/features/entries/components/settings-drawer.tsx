'use client';

export type WritingMode = 'vertical' | 'horizontal';
export type FontFamily = 'serif' | 'sans';
export type TimeInscriptionMode = 'fontSize' | 'fontWeight' | 'pressureBleed';
export type GhostMode = 'block' | 'dust';

export interface EditorSettings {
  writingMode: WritingMode;
  fontFamily: FontFamily;
  fontSize: number;
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
}

export const DEFAULT_SETTINGS: EditorSettings = {
  writingMode: 'vertical',
  fontFamily: 'serif',
  fontSize: 32,
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
};

interface SettingsDrawerProps {
  open: boolean;
  settings: EditorSettings;
  onChange: (patch: Partial<EditorSettings>) => void;
  onClose: () => void;
}

function Toggle({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <label htmlFor={id} className="cursor-pointer text-sm text-zinc-700 dark:text-zinc-300">
        {label}
      </label>
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 cursor-pointer accent-emerald-600"
      />
    </div>
  );
}

function Slider({
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
    <div className="flex items-center gap-3 py-1">
      <label htmlFor={id} className="w-20 shrink-0 text-xs text-zinc-500">
        {label}
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1"
      />
      <span className="w-14 text-right text-xs text-zinc-400">{display}</span>
    </div>
  );
}

function RadioGroup({
  name,
  options,
  value,
  onChange,
}: {
  name: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1 py-1 pl-2">
      {options.map((opt) => (
        <label
          key={opt.value}
          className="flex cursor-pointer items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400"
        >
          <input
            type="radio"
            name={name}
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
            className="accent-emerald-600"
          />
          {opt.label}
        </label>
      ))}
    </div>
  );
}

export function SettingsDrawer({ open, settings, onChange, onClose }: SettingsDrawerProps) {
  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[60] bg-black/20"
        onClick={onClose}
        aria-label="設定を閉じる"
      />
      <div className="fixed top-0 left-0 z-[61] h-full w-80 overflow-y-auto border-r border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
        <div className="p-5">
          <h2 className="mb-4 text-lg font-bold text-zinc-900 dark:text-zinc-100">Settings</h2>

          {/* 基本設定 */}
          <div className="mb-5">
            <div className="mb-2 text-xs font-semibold tracking-wider text-zinc-400">基本設定</div>
            <Slider
              id="font-size"
              label="文字サイズ"
              value={settings.fontSize}
              min={14}
              max={48}
              display={`${settings.fontSize}px`}
              onChange={(v) => onChange({ fontSize: v })}
            />
          </div>

          {/* エフェクト */}
          <div>
            <div className="mb-2 text-xs font-semibold tracking-wider text-zinc-400">
              エフェクト
            </div>

            {/* 時間内包 */}
            <Toggle
              id="time-inscription"
              label="時間内包"
              checked={settings.timeInscriptionEnabled}
              onChange={(v) => onChange({ timeInscriptionEnabled: v })}
            />
            {settings.timeInscriptionEnabled && (
              <RadioGroup
                name="ti-mode"
                options={[
                  { value: 'fontSize', label: '文字サイズ' },
                  { value: 'fontWeight', label: '文字太さ' },
                  { value: 'pressureBleed', label: '圧力にじみ' },
                ]}
                value={settings.timeInscriptionMode}
                // @type-assertion-allowed: radio group onChange returns string, needs cast to union type
                onChange={(v) => onChange({ timeInscriptionMode: v as TimeInscriptionMode })}
              />
            )}

            {/* 消し跡 */}
            <Toggle
              id="eraser-trace"
              label="消し跡"
              checked={settings.eraserTraceEnabled}
              onChange={(v) => onChange({ eraserTraceEnabled: v })}
            />

            {/* 打鍵音増幅 */}
            <Toggle
              id="amp"
              label="打鍵音増幅（ASMR）"
              checked={settings.ampEnabled}
              onChange={(v) => onChange({ ampEnabled: v })}
            />

            {/* 音量内包 */}
            <Toggle
              id="voice"
              label="音量内包"
              checked={settings.voiceEnabled}
              onChange={(v) => onChange({ voiceEnabled: v })}
            />

            {/* ゴースト */}
            <Toggle
              id="ghost"
              label="ゴースト"
              checked={settings.ghostEnabled}
              onChange={(v) => onChange({ ghostEnabled: v })}
            />
            {settings.ghostEnabled && (
              <div className="pl-2">
                <RadioGroup
                  name="ghost-mode"
                  options={[
                    { value: 'block', label: '塊（コミット時）' },
                    { value: 'dust', label: '塵（キー毎）' },
                  ]}
                  value={settings.ghostMode}
                  // @type-assertion-allowed: radio group onChange returns string, needs cast to union type
                  onChange={(v) => onChange({ ghostMode: v as GhostMode })}
                />
                <div className="mt-2 flex flex-col gap-0.5">
                  <Slider
                    id="ghost-size"
                    label="サイズ"
                    value={settings.ghostSize}
                    min={20}
                    max={200}
                    display={`${settings.ghostSize}%`}
                    onChange={(v) => onChange({ ghostSize: v })}
                  />
                  <Slider
                    id="ghost-scatter"
                    label="散乱"
                    value={settings.ghostScatter}
                    min={0}
                    max={100}
                    display={`${settings.ghostScatter}%`}
                    onChange={(v) => onChange({ ghostScatter: v })}
                  />
                  <Slider
                    id="ghost-blur-start"
                    label="初期ブラー"
                    value={settings.ghostBlurStart}
                    min={0}
                    max={20}
                    step={0.5}
                    display={`${settings.ghostBlurStart.toFixed(1)}px`}
                    onChange={(v) => onChange({ ghostBlurStart: v })}
                  />
                  <Slider
                    id="ghost-blur-end"
                    label="最終ブラー"
                    value={settings.ghostBlurEnd}
                    min={2}
                    max={40}
                    step={0.5}
                    display={`${settings.ghostBlurEnd}px`}
                    onChange={(v) => onChange({ ghostBlurEnd: v })}
                  />
                  <Slider
                    id="ghost-duration"
                    label="持続時間"
                    value={settings.ghostDuration}
                    min={30}
                    max={250}
                    display={`${settings.ghostDuration}%`}
                    onChange={(v) => onChange({ ghostDuration: v })}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
