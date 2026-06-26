'use client';

/**
 * 人間QA用ダッシュボード。「Run all」で全ユニット×fixture を実行し verdict グリッドを表示する。
 * 同じ runUnit を CI（matrix test）と window.__verify も使う — 1つの真実、3つの消費者。
 */

import { useEffect, useState } from 'react';
import { allUnits, buildManifest } from '../core/registry';
import { runUnit } from '../core/runner';
import type { Verdict, VerifyResult } from '../core/types';
import { installVerifyHandle } from './handle';

const keyOf = (unitId: string, fixtureId: string) => `${unitId}::${fixtureId}`;

const VERDICT_COLOR: Record<Verdict, string> = {
  PASS: '#059669',
  FAIL: '#dc2626',
  BLOCKED: '#d97706',
  SKIP: '#6b7280',
};

const VERDICT_ORDER: Verdict[] = ['PASS', 'FAIL', 'BLOCKED', 'SKIP'];

export function VerifyDashboard() {
  const manifest = buildManifest();
  const [results, setResults] = useState<Record<string, VerifyResult>>({});
  const [running, setRunning] = useState(false);

  // 稼働中アプリに window.__verify を生やす（エージェント/Playwright の自己検証用）。
  useEffect(() => {
    installVerifyHandle();
  }, []);

  const runAll = async () => {
    setRunning(true);
    const next: Record<string, VerifyResult> = {};
    for (const unit of allUnits()) {
      for (const r of await runUnit(unit)) {
        next[keyOf(r.unitId, r.fixtureId)] = r;
      }
    }
    setResults(next);
    setRunning(false);
  };

  const counts = Object.values(results).reduce<Record<string, number>>((acc, r) => {
    acc[r.verdict] = (acc[r.verdict] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 24, maxWidth: 900 }}>
      <h1 style={{ fontSize: 20 }}>Verify Dashboard</h1>
      <p style={{ color: '#6b7280', fontSize: 13 }}>
        {manifest.length} unit(s). コンソールで <code>window.__verify.runAll()</code> も同じ結果。
      </p>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', margin: '12px 0' }}>
        <button
          type="button"
          onClick={runAll}
          disabled={running}
          style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #d1d5db' }}
        >
          {running ? 'Running…' : 'Run all'}
        </button>
        {Object.keys(counts).length > 0 && (
          <span style={{ fontSize: 13 }}>
            {VERDICT_ORDER.filter((v) => counts[v])
              .map((v) => `${v}: ${counts[v]}`)
              .join('  /  ')}
          </span>
        )}
        <a
          href="/verify/replay"
          style={{
            marginLeft: 'auto',
            fontSize: 13,
            padding: '6px 12px',
            borderRadius: 6,
            border: '1px solid #d1d5db',
            textDecoration: 'none',
          }}
        >
          ▶ Replay（全fixtureをライブ再生）
        </a>
      </div>

      {manifest.map((unit) => (
        <section key={unit.unitId} style={{ marginTop: 18 }}>
          <h2 style={{ fontSize: 15 }}>
            {unit.title} <span style={{ color: '#9ca3af', fontSize: 12 }}>({unit.kind})</span>
          </h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <tbody>
              {unit.fixtures.map((f) => {
                const r = results[keyOf(unit.unitId, f.id)];
                return (
                  <tr key={f.id} style={{ borderTop: '1px solid #eee' }}>
                    <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
                      {f.probe ? '🔍 ' : ''}
                      <code>{f.id}</code>
                    </td>
                    <td style={{ padding: '6px 8px', color: '#6b7280' }}>{f.description}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                      {r ? (
                        <strong style={{ color: VERDICT_COLOR[r.verdict] }}>{r.verdict}</strong>
                      ) : (
                        <span style={{ color: '#d1d5db' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                      <a
                        href={`/verify/${encodeURIComponent(unit.unitId)}/${encodeURIComponent(f.id)}`}
                      >
                        open →
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
