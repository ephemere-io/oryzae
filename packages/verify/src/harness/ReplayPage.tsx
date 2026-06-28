'use client';

/**
 * Replay モード（/verify/replay）。
 *
 * 登録済みの全ユニット×fixture（または ?unit= で 1 ユニットに絞り込み）を、ステージに
 * 1 つずつマウント → verifier 実行 → verdict 表示 → 次へ、と「目に見える形で」順番に回す。
 * 1 つの URL・ナビゲーションのちらつき無しなので、外部スクリーンレコーダ（Playwright の
 * `page.video`, OBS, getDisplayMedia 等）の単一の記録対象にできる。
 *
 * ⚠ これは「記録済み結果の再生」ではなく毎回その場で**ライブ再実行**する。CI ゲート
 * （verify.matrix.test.ts）と同じ runFixture を通すので、緑なら本当に緑。replay 固有の
 * 価値は「見て分かるデモ」と「コミット可能な動画成果物」（scripts/record.ts）。
 *
 * 設定は props で受ける（パッケージをフレームワーク非依存に保つため。クエリ解釈は
 * Next 側のルートが行い props に渡す）:
 *   dwell        各 fixture の結果が出た後の保持時間（ms, 既定 1500）
 *   chromeless   操作 UI/進捗バーを隠す（クリーンな録画用）
 *   autoStart    自動再生で始める（既定 true）
 *   unitId       指定すると 1 ユニットだけを再生（録画を 1 feature に絞る用途）
 *
 * キーボード: Space = 一時停止/再開 ・ → = スキップ ・ Esc = 停止して集計
 *
 * window.__verify_replay = { playing, idx, total, done, results } を公開するので、外部
 * レコーダが開始/終了の手掛かりにポーリングできる。
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { allUnits } from '../core/registry';
import { runFixture } from '../core/runner';
import type { Fixture, VerifiableUnit, VerifyResult } from '../core/types';
import { CheckIcon, VerdictBadge } from './Badge';
import { REPLAY_CSS } from './replayStyles';
import { makeVisibleActContext } from './visibleAct';

export interface ReplayPageProps {
  /** 各 fixture の結果表示を保持する時間（ms）。 */
  dwell?: number;
  /** act 実行前に初期マウントを見せる時間（ms）。 */
  preActMs?: number;
  /** 1 文字あたりのタイプ遅延（ms）。 */
  keystrokeMs?: number;
  /** 操作 UI/進捗を隠す（クリーン録画）。 */
  chromeless?: boolean;
  /** 自動再生で始める（既定 true）。 */
  autoStart?: boolean;
  /** 指定すると 1 ユニットだけ再生する。未指定なら全ユニット。 */
  unitId?: string;
}

interface Step {
  unit: VerifiableUnit<unknown>;
  fixture: Fixture<unknown>;
}

interface ReplayState {
  playing: boolean;
  idx: number;
  total: number;
  done: boolean;
  results: VerifyResult[];
}

declare global {
  interface Window {
    __verify_replay?: ReplayState;
  }
}

export function VerifyReplayPage(props: ReplayPageProps = {}) {
  const dwell = clampInt(props.dwell, 1500, 200, 30_000);
  const preActMs = clampInt(props.preActMs, 350, 0, 5_000);
  const keystrokeMs = clampInt(props.keystrokeMs, 60, 0, 500);
  const chromeless = props.chromeless ?? false;
  const autoStart = props.autoStart ?? true;
  const unitId = props.unitId;

  const steps = useMemo<Step[]>(
    () =>
      allUnits()
        .filter((unit) => !unitId || unit.id === unitId)
        .flatMap((unit) => unit.fixtures.map((fixture) => ({ unit, fixture }))),
    [unitId],
  );

  const [idx, setIdx] = useState(0);
  const [runId, setRunId] = useState(0);
  const [playing, setPlaying] = useState(autoStart);
  const [done, setDone] = useState(false);
  const [results, setResults] = useState<VerifyResult[]>([]);
  const [current, setCurrent] = useState<VerifyResult | null>(null);
  const [action, setAction] = useState<string | null>(null);

  const mountRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<{ root: Root; container: HTMLElement } | null>(null);
  const advanceTimer = useRef<number | null>(null);
  // 非同期クロージャが最新 state を見るための live ref。
  const playingRef = useRef(playing);
  const idxRef = useRef(idx);
  playingRef.current = playing;
  idxRef.current = idx;

  // 外部レコーダ向けに state を公開する。
  useEffect(() => {
    window.__verify_replay = { playing, idx, total: steps.length, done, results };
    return () => {
      window.__verify_replay = undefined;
    };
  }, [playing, idx, done, results, steps.length]);

  // 現在の step をマウント＋検証する。inner-root のライフサイクル（create/render/unmount）は
  // すべて task に遅延させ、外側 React ツリーの commit 中に走らないようにする（さもないと
  // React が inner unmount を遅延させ、こちらと競合し removeChild が throw する）。
  // biome-ignore lint/correctness/useExhaustiveDependencies: idx/done/runId でのみ再実行する設計。advance/steps/dwell 等を依存に入れると毎 step 再マウントしてしまう。
  useEffect(() => {
    if (done || steps.length === 0) return;
    const step = steps[idx];
    if (!step || !mountRef.current) return;
    let cancelled = false;
    setCurrent(null);
    const host = mountRef.current;

    (async () => {
      await task(); // 外側 commit フェーズから抜ける
      if (cancelled) return;

      // step ごとに新しい子コンテナを用意（inner root が完全に所有する）。
      const container = document.createElement('div');
      host.appendChild(container);
      const root = createRoot(container);
      const inner = { root, container };
      innerRef.current = inner;
      root.render(step.unit.render(step.fixture.props));
      await raf();
      if (cancelled) return disposeInner(inner);

      if (step.fixture.act) {
        // 駆動前に初期マウントを見せる。
        if (preActMs > 0) {
          setAction('…');
          await sleep(preActMs);
          if (cancelled) return disposeInner(inner);
        }
        try {
          await step.fixture.act(
            makeVisibleActContext(container, {
              keystrokeMs,
              onAction: setAction,
              isCancelled: () => cancelled,
            }),
          );
        } catch {
          /* act が throw → マウント済みのものを残す。verifier が報告する。 */
        }
        setAction(null);
        await raf();
        if (cancelled) return disposeInner(inner);
        // verdict が出る前に act 後の状態を見せる小休止。
        await sleep(200);
        if (cancelled) return disposeInner(inner);
      }

      const res = await runFixture(step.unit, step.fixture, {
        container,
        alreadyMounted: true,
      });
      if (cancelled) return disposeInner(inner);

      setCurrent(res);
      setResults((r) => [...r, res]);
      if (playingRef.current) {
        advanceTimer.current = window.setTimeout(advance, dwell);
      }
    })();

    return () => {
      cancelled = true;
      if (advanceTimer.current) {
        clearTimeout(advanceTimer.current);
        advanceTimer.current = null;
      }
      // 外側 commit 完了後に走るよう unmount を遅延する。
      const inner = innerRef.current;
      innerRef.current = null;
      if (inner) queueMicrotask(() => disposeInner(inner));
    };
  }, [idx, done, runId]);

  // キーボード操作。
  // biome-ignore lint/correctness/useExhaustiveDependencies: マウント時に1度だけ登録する。ハンドラは最新の関数をクロージャ参照する。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        advance();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        finish();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function advance() {
    if (advanceTimer.current) {
      clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
    const next = idxRef.current + 1;
    if (next >= steps.length) {
      finish();
    } else {
      setIdx(next);
    }
  }

  /** 特定 step へジャンプ。一時停止する（マウント・検証して保持）。 */
  function jumpTo(i: number) {
    if (advanceTimer.current) {
      clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
    setPlaying(false);
    setDone(false);
    setCurrent(null);
    setAction(null);
    setIdx(i);
    setRunId((n) => n + 1);
  }

  /** 特定 step から連続再生を始める。 */
  function playFrom(i: number) {
    jumpTo(i);
    setPlaying(true);
  }

  function togglePlay() {
    setPlaying((p) => {
      const np = !p;
      if (!np && advanceTimer.current) {
        clearTimeout(advanceTimer.current);
        advanceTimer.current = null;
      }
      if (np && current && !advanceTimer.current && !done) {
        advanceTimer.current = window.setTimeout(advance, dwell);
      }
      return np;
    });
  }

  function finish() {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    setPlaying(false);
    setDone(true);
  }

  function restart() {
    setResults([]);
    setCurrent(null);
    setAction(null);
    setIdx(0);
    setDone(false);
    setPlaying(true);
    setRunId((n) => n + 1);
  }

  /* ---------------------- render ---------------------- */

  if (steps.length === 0) {
    return (
      <div className="verify-page replay" data-verify-page="replay">
        <style>{REPLAY_CSS}</style>
        <p>{unitId ? `unit "${unitId}" not found.` : 'No units registered.'}</p>
        <a href="/verify">← dashboard</a>
      </div>
    );
  }

  const step = steps[idx];
  const progress = done ? 1 : (idx + (current ? 1 : 0.5)) / steps.length;
  const summary = summarize(results);

  return (
    <div
      className="verify-page replay"
      data-verify-page="replay"
      data-verify-replay-idx={idx}
      data-verify-replay-total={steps.length}
      data-verify-replay-playing={playing}
      data-verify-replay-done={done}
    >
      <style>{REPLAY_CSS}</style>
      {!chromeless && (
        <header className="replay-header">
          <a href="/verify">← dashboard</a>
          <h1>
            Replay{' '}
            <span className="replay-counter">
              {done ? steps.length : idx + 1} / {steps.length}
            </span>
          </h1>
          <div className="replay-controls">
            {!done && (
              <>
                <button type="button" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
                  {playing ? '❚❚ Pause' : '▶ Play'}
                </button>
                <button type="button" onClick={advance} aria-label="Skip">
                  ⏭ Skip
                </button>
                <button type="button" onClick={finish} aria-label="Stop">
                  ⏹ Stop
                </button>
              </>
            )}
            {done && (
              <button type="button" onClick={restart}>
                ↻ Replay again
              </button>
            )}
            <span className="replay-dwell sub">dwell {dwell}ms</span>
          </div>
          <div className="replay-progress">
            <div className="replay-progress-bar" style={{ width: `${progress * 100}%` }} />
          </div>
          <div className="replay-tally">
            <span className="s-pass">✅ {summary.pass}</span>
            <span className="s-fail">❌ {summary.fail}</span>
            <span className="s-blocked">⛔ {summary.blocked}</span>
          </div>
        </header>
      )}

      <div className="replay-body">
        {!chromeless && (
          <StepList
            steps={steps}
            idx={idx}
            done={done}
            results={results}
            onJump={jumpTo}
            onPlayFrom={playFrom}
          />
        )}

        <div className="replay-main">
          {!done && (
            <div
              className={`app-frame ${current ? `verdict-${current.verdict.toLowerCase()}` : ''}`}
              data-verify-stage="true"
            >
              <div className="app-frame-titlebar">
                <span className="tl-dot r" />
                <span className="tl-dot y" />
                <span className="tl-dot g" />
                <span className="app-frame-title">
                  <span className="kind">{step.unit.kind}</span>
                  <strong>{step.unit.title}</strong>
                  <span className="dim"> / {step.fixture.id}</span>
                  {step.fixture.probe && <span className="probe-chip">🔍 probe</span>}
                </span>
              </div>

              <div className="app-frame-desc">{step.fixture.description}</div>

              <div className="app-frame-body">
                <span className="app-frame-body-label">rendered component</span>
                <div className="verify-mount" ref={mountRef} data-verify-mount="true" />
                <div
                  className={`replay-action ${action ? 'on' : ''}`}
                  data-verify-action-caption={action ?? ''}
                >
                  {action ?? ''}
                </div>
              </div>

              <FrameStatus result={current} />
            </div>
          )}

          {done && <ReplaySummary results={results} steps={steps} />}
        </div>
      </div>
    </div>
  );
}

/* ---------------------- subcomponents ---------------------- */

function StepList({
  steps,
  idx,
  done,
  results,
  onJump,
  onPlayFrom,
}: {
  steps: Step[];
  idx: number;
  done: boolean;
  results: VerifyResult[];
  onJump: (i: number) => void;
  onPlayFrom: (i: number) => void;
}) {
  const verdictFor = (s: Step) =>
    results.find((r) => r.unitId === s.unit.id && r.fixtureId === s.fixture.id)?.verdict;

  // ユニットでグルーピングしてリストを読みやすくする。
  const groups: Array<{ unit: Step['unit']; rows: Array<{ i: number; s: Step }> }> = [];
  steps.forEach((s, i) => {
    const last = groups[groups.length - 1];
    if (last && last.unit.id === s.unit.id) last.rows.push({ i, s });
    else groups.push({ unit: s.unit, rows: [{ i, s }] });
  });

  return (
    <aside className="step-list" aria-label="All fixtures">
      {groups.map((g) => (
        <div key={g.unit.id} className="step-group">
          <div className="step-group-head">
            <span className="kind">{g.unit.kind}</span>
            <strong>{g.unit.title}</strong>
          </div>
          {g.rows.map(({ i, s }) => {
            const v = verdictFor(s);
            const active = !done && i === idx;
            return (
              <div
                key={s.fixture.id}
                className={`step-row ${active ? 'active' : ''} ${v ? `v-${v.toLowerCase()}` : ''}`}
                data-verify-step={`${s.unit.id}::${s.fixture.id}`}
              >
                <button
                  type="button"
                  className="step-jump"
                  onClick={() => onJump(i)}
                  title={`Run only ${s.unit.id}/${s.fixture.id}`}
                  aria-label={`Run only ${s.unit.id}/${s.fixture.id}`}
                >
                  <span className="step-status">
                    {v === 'PASS'
                      ? '✅'
                      : v === 'FAIL'
                        ? '❌'
                        : v === 'BLOCKED'
                          ? '⛔'
                          : active
                            ? '▸'
                            : '○'}
                  </span>
                  <span className="step-name">
                    {s.fixture.probe && '🔍 '}
                    {s.fixture.id}
                  </span>
                </button>
                <button
                  type="button"
                  className="step-play"
                  onClick={() => onPlayFrom(i)}
                  title="Play from here"
                  aria-label={`Play from ${s.unit.id}/${s.fixture.id}`}
                >
                  ▶
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </aside>
  );
}

/** app-frame 下部のステータスバー: verdict ＋ check 集計。fail/warn は inline で列挙。
 *  結果が出るまで "running…" を出してフレームが跳ねないようにする。 */
function FrameStatus({ result }: { result: VerifyResult | null }) {
  if (!result) {
    return (
      <div className="app-frame-status running">
        <span className="spinner" /> <span className="sub">running checks…</span>
      </div>
    );
  }
  const fails = result.checks.filter((c) => c.status === 'fail');
  const warns = result.checks.filter((c) => c.status === 'warn');
  const counts = {
    ok: result.checks.filter((c) => c.status === 'ok').length,
    probe: result.checks.filter((c) => c.status === 'probe').length,
    warn: warns.length,
    fail: fails.length,
  };
  return (
    <div
      className={`app-frame-status v-${result.verdict.toLowerCase()}`}
      data-verdict={result.verdict}
    >
      <div className="status-line">
        <VerdictBadge verdict={result.verdict} />
        <span className="status-counts">
          {counts.ok > 0 && <span>✅ {counts.ok}</span>}
          {counts.probe > 0 && <span>🔍 {counts.probe}</span>}
          {counts.warn > 0 && <span>⚠️ {counts.warn}</span>}
          {counts.fail > 0 && <span>❌ {counts.fail}</span>}
        </span>
        <span className="sub status-meta">
          {result.checks.length} checks · {result.durationMs}ms
        </span>
      </div>
      {result.blockedReason && <p className="status-detail blocked">⛔ {result.blockedReason}</p>}
      {(fails.length > 0 || warns.length > 0) && (
        <ul className="status-issues">
          {fails.map((c) => (
            <li key={`fail:${c.verifier}:${c.label}`}>
              <CheckIcon status="fail" /> <code>[{c.verifier}]</code> {c.label}
              {c.detail && <span className="check-detail"> — {c.detail}</span>}
            </li>
          ))}
          {fails.length === 0 &&
            warns.map((c) => (
              <li key={`warn:${c.verifier}:${c.label}`}>
                <CheckIcon status="warn" /> <code>[{c.verifier}]</code> {c.label}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

function ReplaySummary({ results, steps }: { results: VerifyResult[]; steps: Step[] }) {
  const s = summarize(results);
  return (
    <section className="replay-summary" data-verify-replay-summary={JSON.stringify(s)}>
      <h2>Summary</h2>
      <p className="replay-summary-line">
        <span className="s-pass">✅ {s.pass}</span> <span className="s-fail">❌ {s.fail}</span>{' '}
        <span className="s-blocked">⛔ {s.blocked}</span>{' '}
        <span className="sub">
          / {results.length} of {steps.length}
        </span>
      </p>
      <table className="fixture-table">
        <thead>
          <tr>
            <th>Unit</th>
            <th>Fixture</th>
            <th>Verdict</th>
            <th>ms</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r) => (
            <tr key={`${r.unitId}::${r.fixtureId}`}>
              <td>
                <code>{r.unitId}</code>
              </td>
              <td>
                <code>{r.fixtureId}</code>
              </td>
              <td>
                <VerdictBadge verdict={r.verdict} />
              </td>
              <td className="sub">{r.durationMs}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/* ---------------------- helpers ---------------------- */

function summarize(results: VerifyResult[]) {
  return {
    pass: results.filter((r) => r.verdict === 'PASS').length,
    fail: results.filter((r) => r.verdict === 'FAIL').length,
    blocked: results.filter((r) => r.verdict === 'BLOCKED').length,
  };
}

function clampInt(raw: number | undefined, fallback: number, min: number, max: number) {
  if (raw === undefined || Number.isNaN(raw)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(raw)));
}

function raf() {
  return new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
}

/** 現在の React commit フェーズから完全に抜ける。 */
function task() {
  return new Promise<void>((r) => setTimeout(r, 0));
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

/** inner root を unmount し container を host から外す。呼び出し側が外側 commit の外で
 *  実行することを保証する（task/microtask で遅延）。 */
function disposeInner(inner: { root: Root; container: HTMLElement }) {
  try {
    inner.root.unmount();
  } catch {
    /* already unmounted */
  }
  inner.container.remove();
}
