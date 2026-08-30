'use client';

interface SwitchProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}

/**
 * ON/OFF のトグル。ネイティブ checkbox の見た目（OS 依存の四角）を置き換える。
 *
 * `role="switch"` を持つボタン1つで表現する。設定パネルの行は「ラベル ⟷ コントロール」で
 * 揃えたいので、ラベルまで含めて1行を構成する。
 */
export function Switch({ id, checked, onChange, label }: SwitchProps) {
  return (
    // 行の高さは設定パネルの Row と揃える（32px）。目が同じ間隔で下りていける。
    <div className="flex h-8 items-center justify-between gap-3">
      <label htmlFor={id} className="cursor-pointer text-[13px] text-[var(--fg)]">
        {label}
      </label>
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        // ノブしか中身が無いので、ラベルは aria-label で明示する。
        // `<label htmlFor>` だけだとブラウザは名前を拾うが、DOM を静的に読む検証系
        // （packages/verify の a11y verifier）は button の label[for] を辿らない。
        aria-label={label}
        onClick={() => onChange(!checked)}
        className="relative h-[18px] w-8 shrink-0 rounded-full transition-colors"
        style={{
          background: checked ? 'var(--accent)' : 'var(--border-subtle)',
        }}
      >
        <span
          aria-hidden="true"
          className="absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white transition-[left] duration-150"
          style={{ left: checked ? '16px' : '2px' }}
        />
      </button>
    </div>
  );
}
