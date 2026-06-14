'use client';

/**
 * 孤立マウントページ。1つのユニット×fixture だけを可視マウントし、その実物 DOM に対して
 * 検証を回す。結果は画面表示 ＋ window.__verify.current()（と #verify-result-json）に反映。
 * エージェント/Playwright がこのルートに来て observe する想定。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { getUnit } from '../core/registry';
import { runFixture } from '../core/runner';
import type { Check, Verdict, VerifyResult } from '../core/types';
import { installVerifyHandle, setCurrentResult } from './handle';

const VERDICT_COLOR: Record<Verdict, string> = {
  PASS: '#059669',
  FAIL: '#dc2626',
  BLOCKED: '#d97706',
  SKIP: '#6b7280',
};

const CHECK_ICON: Record<Check['status'], string> = {
  ok: '✅',
  fail: '❌',
  warn: '⚠️',
  probe: '🔍',
};

export function VerifyUnitPage({ unitId, fixtureId }: { unitId: string; fixtureId: string }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setError(null);
    const unit = getUnit(unitId);
    if (!unit) {
      setError(`unknown unit "${unitId}"`);
      return;
    }
    const fixture = unit.fixtures.find((f) => f.id === fixtureId);
    if (!fixture) {
      setError(`unknown fixture "${fixtureId}" on unit "${unitId}"`);
      return;
    }
    const container = mountRef.current;
    if (!container) return;
    // 毎回フレッシュなホストに描画する（同一ノードへの createRoot 再呼び出しを避ける）。
    const host = document.createElement('div');
    container.replaceChildren(host);
    const r = await runFixture(unit, fixture, { container: host, keepMounted: true });
    setResult(r);
    setCurrentResult(r);
  }, [unitId, fixtureId]);

  useEffect(() => {
    void run();
  }, [run]);

  // 稼働中アプリに window.__verify を生やす（エージェント/Playwright の自己検証用）。
  useEffect(() => {
    installVerifyHandle();
  }, []);

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 24, maxWidth: 900 }}>
      <p style={{ fontSize: 13 }}>
        <a href="/verify">← dashboard</a>
      </p>
      <h1 style={{ fontSize: 18 }}>
        <code>{unitId}</code> / <code>{fixtureId}</code>
      </h1>
      <button
        type="button"
        onClick={() => void run()}
        style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #d1d5db' }}
      >
        Re-run
      </button>

      {error && <p style={{ color: '#dc2626' }}>{error}</p>}

      <h2 style={{ fontSize: 14, marginTop: 16 }}>Live mount</h2>
      <div
        ref={mountRef}
        style={{ border: '1px dashed #d1d5db', borderRadius: 8, padding: 16, minHeight: 48 }}
      />

      {result && (
        <>
          <h2 style={{ fontSize: 14, marginTop: 16 }}>
            Verdict: <span style={{ color: VERDICT_COLOR[result.verdict] }}>{result.verdict}</span>{' '}
            <span style={{ color: '#9ca3af', fontSize: 12 }}>({result.durationMs}ms)</span>
          </h2>
          <ul style={{ fontSize: 13, lineHeight: 1.7, listStyle: 'none', paddingLeft: 0 }}>
            {result.checks.map((c) => (
              <li key={`${c.verifier}:${c.label}`}>
                {CHECK_ICON[c.status]} <code>[{c.verifier}]</code> {c.label}
                {c.detail && <span style={{ color: '#9ca3af' }}> — {c.detail}</span>}
              </li>
            ))}
          </ul>
        </>
      )}

      {/* DOM しか読めないエージェント向けの結果置き場 */}
      <pre id="verify-result-json" style={{ display: 'none' }} />
    </div>
  );
}
