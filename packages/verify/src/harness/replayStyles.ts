/**
 * ReplayPage 用のスタイル。<style> タグとして注入する。
 *
 * なぜ注入か:
 *  - visibleAct.ts が `.verify-act-ring` を document.body 直下に append し、グローバルな
 *    クラス名で CSS トランジションを当てる。インラインスタイルでも（ハッシュ化される）
 *    CSS Modules でもこのグローバル名は表現できない。
 *  - dev 限定の検証ページ専用なので、自己完結した <style> が一番素直。
 *
 * 変数は衝突回避のため `--vr-*` に namespace 済み（ホストアプリの --border 等を踏まない）。
 * 要素リセット（button/code/a）は `.verify-page.replay` 配下にスコープしてホスト側へ漏らさない。
 */

export const REPLAY_CSS = `
:root {
  --vr-bg: #f7f8fa;
  --vr-panel: #ffffff;
  --vr-panel2: #eef0f4;
  --vr-border: #d8dce4;
  --vr-text: #1b1f27;
  --vr-dim: #6a7183;
  --vr-accent: #3a66e0;
  --vr-pass: #1f9d63;
  --vr-fail: #d4384e;
  --vr-warn: #c28a12;
  --vr-blocked: #7b4fd6;
  --vr-probe: #2a8fb3;
  --vr-mono: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.verify-page.replay, .verify-page.replay * { box-sizing: border-box; }
.verify-page.replay button {
  font: inherit; background: var(--vr-panel2); color: var(--vr-text);
  border: 1px solid var(--vr-border); border-radius: 6px; padding: 6px 12px; cursor: pointer;
}
.verify-page.replay button:hover:not(:disabled) { border-color: var(--vr-accent); }
.verify-page.replay button:disabled { opacity: 0.4; cursor: not-allowed; }
.verify-page.replay code {
  font-family: var(--vr-mono); background: var(--vr-panel2);
  padding: 1px 5px; border-radius: 4px; font-size: 0.88em;
}
.verify-page.replay a { color: var(--vr-accent); text-decoration: none; }
.verify-page.replay a:hover { text-decoration: underline; }
.verify-page.replay strong { color: #0d1117; }

.verify-page { max-width: 980px; margin: 0 auto; padding: 30px 24px 80px; }
.verify-page.replay { max-width: 1280px; color-scheme: light; }
.verify-page h1 { font-size: 24px; margin: 8px 0 4px; }
.s-pass { color: var(--vr-pass); }
.s-fail { color: var(--vr-fail); }
.s-blocked { color: var(--vr-blocked); }
.fixture-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
.fixture-table th {
  text-align: left;
  color: var(--vr-dim);
  font-weight: 500;
  border-bottom: 1px solid var(--vr-border);
  padding: 4px 8px 6px 0;
}
.fixture-table td { padding: 7px 8px 7px 0; border-bottom: 1px solid var(--vr-border); }
.verdict {
  display: inline-block;
  font: 600 11px/1 var(--vr-mono);
  padding: 4px 8px;
  border-radius: 5px;
  letter-spacing: 0.04em;
}
.verdict-pass { background: color-mix(in srgb, var(--vr-pass) 18%, transparent); color: var(--vr-pass); }
.verdict-fail { background: color-mix(in srgb, var(--vr-fail) 18%, transparent); color: var(--vr-fail); }
.verdict-blocked { background: color-mix(in srgb, var(--vr-blocked) 18%, transparent); color: var(--vr-blocked); }
.verdict-skip { background: var(--vr-panel2); color: var(--vr-dim); }
.check-verifier { color: var(--vr-dim); font-family: var(--vr-mono); font-size: 12px; flex-shrink: 0; }
.check-detail { color: var(--vr-dim); }
.check-fail .check-label, .check-fail .check-detail { color: var(--vr-fail); }
.check-warn .check-label { color: var(--vr-warn); }
.check-probe .check-label { color: var(--vr-probe); }

/* ---------- Replay ---------- */
.replay-header { margin-bottom: 18px; }
.replay-header h1 { display: flex; align-items: baseline; gap: 12px; }
.replay-counter {
  font: 500 15px var(--vr-mono);
  color: var(--vr-dim);
  font-variant-numeric: tabular-nums;
}
.replay-controls {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 10px 0 12px;
}
.replay-dwell { font-size: 12.5px; }
.replay-progress {
  height: 5px;
  background: var(--vr-panel2);
  border: 1px solid var(--vr-border);
  border-radius: 4px;
  overflow: hidden;
  margin: 8px 0;
}
.replay-progress-bar {
  height: 100%;
  background: var(--vr-accent);
  transition: width 200ms ease;
}
.replay-tally {
  display: flex;
  gap: 14px;
  font-variant-numeric: tabular-nums;
  font-size: 13.5px;
  margin-top: 6px;
}

/* ---------- Replay layout: sidebar + main ---------- */
.replay-body {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 22px;
  align-items: start;
}
@media (max-width: 960px) {
  .replay-body { grid-template-columns: 1fr; }
}
.replay-main {
  min-width: 0;
  /* 白い app-frame が何かの「上に」乗って見えるよう、地を暗めにする。 */
  background: linear-gradient(180deg, #e9ecf2 0%, #e2e6ee 100%);
  border: 1px solid var(--vr-border);
  border-radius: 14px;
  padding: 28px;
}

/* Step list sidebar */
.step-list {
  position: sticky;
  top: 16px;
  max-height: calc(100vh - 32px);
  overflow-y: auto;
  background: var(--vr-panel);
  border: 1px solid var(--vr-border);
  border-radius: 10px;
  padding: 10px;
  box-shadow: 0 1px 3px rgba(16, 24, 40, 0.05);
}
.step-group { margin-bottom: 10px; }
.step-group:last-child { margin-bottom: 0; }
.step-group-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 6px 4px;
  font-size: 13px;
}
.step-group-head .kind {
  font-size: 9.5px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--vr-dim);
  border: 1px solid var(--vr-border);
  border-radius: 4px;
  padding: 1px 5px;
}
.step-row {
  display: flex;
  align-items: stretch;
  gap: 4px;
  margin: 2px 0;
}
.step-jump {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  text-align: left;
  border: 1px solid transparent;
  background: transparent;
  border-radius: 6px;
  padding: 5px 8px;
  font-size: 13px;
  min-width: 0;
}
.step-jump:hover { background: var(--vr-panel2); }
.step-row.active .step-jump {
  background: color-mix(in srgb, var(--vr-accent) 10%, var(--vr-panel));
  border-color: color-mix(in srgb, var(--vr-accent) 35%, var(--vr-border));
}
.step-status { width: 1.3em; flex-shrink: 0; text-align: center; }
.step-name {
  font-family: var(--vr-mono);
  font-size: 12.5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.step-row.v-fail .step-name { color: var(--vr-fail); }
.step-play {
  border: 1px solid transparent;
  background: transparent;
  border-radius: 6px;
  padding: 0 8px;
  color: var(--vr-dim);
  font-size: 11px;
}
.step-play:hover { background: var(--vr-panel2); color: var(--vr-accent); }

/* ---------- App-window stage frame ----------
   The frame is THE test: titlebar = identity, desc strip = scenario,
   body = the live rendered component, status bar = verdict. One object. */
.app-frame {
  background: var(--vr-panel);
  border: 1px solid var(--vr-border);
  border-radius: 12px;
  overflow: hidden;
  box-shadow:
    0 2px 4px rgba(16, 24, 40, 0.08),
    0 20px 48px -12px rgba(16, 24, 40, 0.28);
  transition: box-shadow 200ms ease;
}
.app-frame.verdict-pass { box-shadow:
  0 0 0 3px color-mix(in srgb, var(--vr-pass) 30%, transparent),
  0 20px 48px -12px rgba(16, 24, 40, 0.28); }
.app-frame.verdict-fail { box-shadow:
  0 0 0 3px color-mix(in srgb, var(--vr-fail) 40%, transparent),
  0 20px 48px -12px rgba(16, 24, 40, 0.28); }
.app-frame.verdict-blocked { box-shadow:
  0 0 0 3px color-mix(in srgb, var(--vr-blocked) 40%, transparent),
  0 20px 48px -12px rgba(16, 24, 40, 0.28); }

.app-frame-titlebar {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 38px;
  padding: 0 14px;
  background: linear-gradient(to bottom, #fafbfc, var(--vr-panel2));
  border-bottom: 1px solid var(--vr-border);
}
.tl-dot { width: 11px; height: 11px; border-radius: 50%; flex-shrink: 0; }
.tl-dot.r { background: #ff5f57; }
.tl-dot.y { background: #febc2e; }
.tl-dot.g { background: #28c840; }
.app-frame-title {
  margin-left: 10px;
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 13.5px;
  min-width: 0;
  overflow: hidden;
}
.app-frame-title .kind {
  font-size: 9.5px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--vr-dim);
  border: 1px solid var(--vr-border);
  border-radius: 4px;
  padding: 2px 5px;
  background: #fff;
}
.app-frame-title .dim { color: var(--vr-dim); font-family: var(--vr-mono); font-size: 12.5px; }
.app-frame-title .probe-chip {
  font-size: 11px;
  color: var(--vr-probe);
  border: 1px solid color-mix(in srgb, var(--vr-probe) 40%, var(--vr-border));
  border-radius: 4px;
  padding: 1px 6px;
  background: color-mix(in srgb, var(--vr-probe) 8%, #fff);
}

.app-frame-desc {
  padding: 9px 16px;
  font-size: 13.5px;
  color: var(--vr-dim);
  background: #fcfcfd;
  border-bottom: 1px solid var(--vr-border);
}

.app-frame-body {
  position: relative;
  background: #ffffff;
  padding: 32px 28px 24px;
  min-height: 220px;
}
.app-frame-body-label {
  position: absolute;
  top: 8px;
  right: 12px;
  font: 600 10px/1 var(--vr-mono);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: color-mix(in srgb, var(--vr-dim) 60%, #fff);
  user-select: none;
}

.app-frame-status {
  border-top: 1px solid var(--vr-border);
  padding: 12px 16px;
  background: #fcfcfd;
}
.app-frame-status.running {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--vr-dim);
}
.app-frame-status.v-pass { background: color-mix(in srgb, var(--vr-pass) 6%, #fcfcfd); }
.app-frame-status.v-fail { background: color-mix(in srgb, var(--vr-fail) 6%, #fcfcfd); }
.app-frame-status.v-blocked { background: color-mix(in srgb, var(--vr-blocked) 6%, #fcfcfd); }
.status-line { display: flex; align-items: center; gap: 14px; }
.status-counts {
  display: flex;
  gap: 10px;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
.status-meta { margin-left: auto; font-size: 12.5px; }
.status-issues {
  list-style: none;
  margin: 8px 0 0;
  padding: 8px 0 0;
  border-top: 1px dashed var(--vr-border);
  font-size: 13px;
}
.status-issues li { padding: 3px 0; }
.status-issues code { font-size: 11.5px; }
.status-detail.blocked { color: var(--vr-blocked); margin: 6px 0 0; }

.spinner {
  width: 12px;
  height: 12px;
  border: 2px solid var(--vr-border);
  border-top-color: var(--vr-accent);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.replay-action {
  margin-top: 14px;
  min-height: 22px;
  font: 13px var(--vr-mono);
  color: var(--vr-probe);
  opacity: 0;
  transform: translateY(-2px);
  transition: opacity 120ms ease, transform 120ms ease;
}
.replay-action.on { opacity: 1; transform: translateY(0); }

/* visibleAct.ts が操作対象に描くハイライトリング。 */
.verify-act-ring {
  border: 2px solid var(--vr-accent);
  border-radius: 8px;
  box-shadow: 0 0 0 0 color-mix(in srgb, var(--vr-accent) 60%, transparent);
  opacity: 0;
  transition: opacity 80ms ease, box-shadow 180ms ease-out;
}
.verify-act-ring.on {
  opacity: 1;
  box-shadow: 0 0 0 6px color-mix(in srgb, var(--vr-accent) 25%, transparent);
}
.verify-act-ring.soft {
  border-color: var(--vr-probe);
  box-shadow: 0 0 0 0 color-mix(in srgb, var(--vr-probe) 50%, transparent);
}
.verify-act-ring.soft.on {
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--vr-probe) 20%, transparent);
}

.replay-summary {
  background: var(--vr-panel);
  border: 1px solid var(--vr-border);
  border-radius: 10px;
  padding: 20px 22px;
  margin-top: 16px;
}
.replay-summary h2 { margin: 0 0 8px; font-size: 20px; }
.replay-summary-line {
  display: flex;
  gap: 16px;
  align-items: baseline;
  font-size: 16px;
  font-variant-numeric: tabular-nums;
  margin-bottom: 14px;
}
`;
