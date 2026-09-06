#!/usr/bin/env node
/**
 * 自動修正ループの予算ガバナー — 月額のトークン費用に硬い上限を敷く。
 *
 * なぜ必要か:
 * AI に「バグを探して直す」を任せると、費用は探索の深さで決まり、事前に読めない。
 * 「気づいたら月 4,000 円」を避ける唯一の方法は、実行前に残額を計算して
 * 足りなければ **走らせない** ことである。上限は運用ルールではなくコードで守る。
 *
 * 二段構えにしている:
 *   1. 月次上限 — この台帳（GitHub Issue の本文に埋めた JSON）で管理する
 *   2. 1 回あたり上限 — Claude CLI の `--max-budget-usd` に渡し、セッション自身に打ち切らせる
 *
 * 2 だけでは「安い実行を無限に繰り返す」を止められず、1 だけでは
 * 「1 回の暴走で月の枠を使い切る」を止められない。両方要る。
 *
 * 台帳を Issue 本文に置く理由:
 * ブランチやキャッシュに置くと人間の目に触れない。Actions のキャッシュは 7 日で消え、
 * Actions variables は GITHUB_TOKEN から書けない。Issue なら GITHUB_TOKEN で更新でき、
 * 「今月いくら使ったか」がリポジトリを開けばそのまま読める。
 *
 * 失敗時は必ず閉じる側に倒す（fail closed）:
 * 台帳が壊れている・費用が読めない、といった不明な状態では「実行しない」
 * 「上限いっぱい使ったものとして記録する」を選ぶ。予算の見落としは静かに起きるため。
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** 台帳 JSON を囲むフェンス。Issue 本文からこの範囲だけを機械が読む。 */
const FENCE_OPEN = '```json ledger';
const FENCE_CLOSE = '```';

/** 月あたりに残す履歴の件数。Issue 本文の 65536 文字上限に触れないための蓋。 */
const MAX_RUNS_PER_MONTH = 40;
/** 保持する月数。 */
const MAX_MONTHS = 6;

const EMPTY_LEDGER = { version: 1, months: {} };

/**
 * JST の「年-月」を返す。
 *
 * 予算は円建ての月額なので、区切りも生活時間（JST）に合わせる。UTC で切ると
 * 月初 9 時間ぶんが前月に計上され、「今月まだ使っていないはずなのに枠が無い」が起きる。
 * JST は夏時間が無いので固定 +9 時間で正しい。
 */
export function monthKey(date = new Date()) {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 7);
}

/**
 * Issue 本文から台帳を取り出す。
 *
 * 読めなければ null を返す（呼び出し側は「実行しない」に倒す）。人が本文を
 * 手で編集して JSON を壊したとき、0 円扱いで走り続けるのが最悪であるため。
 */
export function parseLedger(body) {
  if (typeof body !== 'string') return null;
  const start = body.indexOf(FENCE_OPEN);
  if (start === -1) return null;
  const from = start + FENCE_OPEN.length;
  const end = body.indexOf(FENCE_CLOSE, from);
  if (end === -1) return null;
  try {
    const parsed = JSON.parse(body.slice(from, end));
    if (!parsed || typeof parsed !== 'object' || typeof parsed.months !== 'object') return null;
    return { version: 1, months: parsed.months ?? {} };
  } catch {
    return null;
  }
}

/** 今月の使用額（USD）。未記録の月は 0。 */
export function spentUsd(ledger, month) {
  const m = ledger?.months?.[month];
  return typeof m?.spentUsd === 'number' && Number.isFinite(m.spentUsd) ? m.spentUsd : 0;
}

/**
 * 円の月額上限を USD 上限に直す。
 *
 * 為替は保守側（円安側）に置く。1 ドルを高く見積もるほど USD 上限は小さくなり、
 * 実際の請求は狙った円額を下回る。逆向きに外すと上限を超える。
 */
export function capUsd({ budgetJpy, jpyPerUsd }) {
  if (!(budgetJpy > 0) || !(jpyPerUsd > 0)) return 0;
  return budgetJpy / jpyPerUsd;
}

/**
 * 直近の「費用は使ったが何も入らなかった」実行が何回続いているかを数える。
 *
 * 数える対象:
 *   - gates-failed / blocked … 差分は出たがマージできなかった
 *   - aborted               … 1 回あたりの上限に当たって途中で切られた
 *
 * どれも直し方の問題ではなく前提の問題（ハーネスが変わった・指示が古い・
 * 対象が大きすぎる・上限が低すぎる）であることが多い。そのまま回すと毎回同じ壁に
 * 当たって予算だけが減る。人が見るまで止める。
 *
 * aborted を数える理由は実測にある。初回実行（2026-09-06）は effort=high・上限 $0.60 で
 * 30 ターン・175 秒を使い切って中断した。上限と対象の大きさが釣り合っていないと、
 * 何度でも同じように使い切る。「使い切ったのに何も残らない」は止めるべき兆候である。
 *
 * 「何も見つからなかった（no-fix）」は数えない。巡回で問題が無いのは正しい結果であり、
 * それで止めると、壊れたものを直す経路まで巻き添えで止まる。
 */
export function barrenStreak(ledger) {
  const runs = Object.keys(ledger?.months ?? {})
    .sort()
    .flatMap((m) => ledger.months[m].runs ?? []);
  let streak = 0;
  for (let i = runs.length - 1; i >= 0; i--) {
    const result = String(runs[i]?.result ?? '');
    if (
      result.startsWith('gates-failed') ||
      result.startsWith('blocked') ||
      result.startsWith('aborted')
    ) {
      streak++;
    } else break;
  }
  return streak;
}

/**
 * この実行を走らせてよいか、走らせるならいくらまで使ってよいかを決める。
 *
 * `kind` を 2 系統に分ける:
 *   - reactive（main が赤い / ラベル付き Issue）— 残額がある限り走る
 *   - sweep（定期巡回）— 予備枠（reservePct）を食い潰さない範囲でだけ走る
 *
 * 予備枠が要るのは、巡回が月初に枠を使い切ると「main が壊れたのに直せない」
 * が起きるため。壊れているものを直す方が、探しに行くより常に優先度が高い。
 */
export function plan({
  ledger,
  month,
  capUsd: cap,
  perRunCapUsd,
  reservePct = 30,
  minRunUsd = 0.15,
  maxBarren = 3,
  kind = 'sweep',
}) {
  if (ledger === null) {
    return { allowed: false, budgetUsd: 0, remainingUsd: 0, reason: '台帳を読めなかった（安全側で停止）' };
  }
  const barren = barrenStreak(ledger);
  if (barren >= maxBarren) {
    return {
      allowed: false,
      budgetUsd: 0,
      remainingUsd: Math.max(0, cap - spentUsd(ledger, month)),
      reason: `マージできない修正が ${barren} 回続いた（安全装置。台帳 Issue を確認し、直したうえで解除する）`,
    };
  }
  const used = spentUsd(ledger, month);
  const remaining = Math.max(0, cap - used);
  const reserve = kind === 'sweep' ? cap * (reservePct / 100) : 0;
  const usable = Math.max(0, remaining - reserve);

  if (usable < minRunUsd) {
    const label = kind === 'sweep' ? `予備枠 ${reserve.toFixed(2)} を除いた` : '';
    return {
      allowed: false,
      budgetUsd: 0,
      remainingUsd: remaining,
      reason: `今月の残額が足りない（上限 $${cap.toFixed(2)} / 使用 $${used.toFixed(2)} / ${label}使える額 $${usable.toFixed(2)} < 最低 $${minRunUsd.toFixed(2)}）`,
    };
  }
  return {
    allowed: true,
    budgetUsd: round(Math.min(perRunCapUsd, usable)),
    remainingUsd: remaining,
    reason: `残額 $${remaining.toFixed(2)}（上限 $${cap.toFixed(2)} / 使用 $${used.toFixed(2)}）`,
  };
}

/** 小数の丸め。台帳に載る数字が 0.30000000000000004 にならないようにする。 */
function round(n) {
  return Math.round(n * 10000) / 10000;
}

/** 実行 1 件を台帳に足す。元の台帳は変更しない。 */
export function recordRun(ledger, month, entry) {
  const base = ledger ?? structuredClone(EMPTY_LEDGER);
  const months = { ...base.months };
  const prev = months[month] ?? { spentUsd: 0, runs: [] };
  const runs = [...(prev.runs ?? []), entry].slice(-MAX_RUNS_PER_MONTH);
  months[month] = { spentUsd: round(spentUsd(base, month) + (entry.costUsd ?? 0)), runs };

  // 古い月から落とす。台帳は「今月あといくら使えるか」のための道具であって、
  // 恒久的な会計記録ではない（実額は Anthropic Console が正）。
  const kept = Object.keys(months)
    .sort()
    .slice(-MAX_MONTHS);
  return { version: 1, months: Object.fromEntries(kept.map((k) => [k, months[k]])) };
}

/**
 * Claude Code の実行ログから実費（USD）を取り出す。
 *
 * 形式が変わっても壊れないよう 3 段で試す。どれも駄目なら null を返し、
 * 呼び出し側が「上限いっぱい使った」として記録する（過少計上を作らない）。
 */
export function extractCostUsd(text) {
  if (typeof text !== 'string' || text.trim() === '') return null;

  // 1. 配列 or 単一オブジェクトの JSON
  try {
    const parsed = JSON.parse(text);
    const found = findCost(parsed);
    if (found !== null) return found;
  } catch {
    // 次へ
  }

  // 2. JSONL（1 行 1 メッセージ）
  let last = null;
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (t === '') continue;
    try {
      const found = findCost(JSON.parse(t));
      if (found !== null) last = found;
    } catch {
      // 壊れた行は飛ばす
    }
  }
  if (last !== null) return last;

  // 3. 最後の手段。キーだけを拾う
  const matches = [...text.matchAll(/"total_cost_usd"\s*:\s*(-?\d+(?:\.\d+)?)/g)];
  if (matches.length > 0) return Number(matches[matches.length - 1][1]);
  return null;
}

/** 入れ子のどこかにある total_cost_usd を、最後に現れたものを優先して拾う。 */
function findCost(node) {
  if (Array.isArray(node)) {
    for (let i = node.length - 1; i >= 0; i--) {
      const found = findCost(node[i]);
      if (found !== null) return found;
    }
    return null;
  }
  if (node && typeof node === 'object') {
    if (typeof node.total_cost_usd === 'number' && Number.isFinite(node.total_cost_usd)) {
      return node.total_cost_usd;
    }
    for (const value of Object.values(node)) {
      const found = findCost(value);
      if (found !== null) return found;
    }
  }
  return null;
}

/** Issue 本文を組み立てる。人が読む表と、機械が読む JSON を両方載せる。 */
export function renderIssueBody(ledger, { capUsd: cap, budgetJpy, jpyPerUsd, month }) {
  const used = spentUsd(ledger, month);
  const remaining = Math.max(0, cap - used);
  const pct = cap > 0 ? Math.round((used / cap) * 100) : 0;
  const runs = (ledger.months?.[month]?.runs ?? []).slice().reverse();

  const lines = [
    '<!-- auto-fix-ledger -->',
    '# 自動修正ループ — 予算台帳と稼働状況',
    '',
    'この Issue は `.github/workflows/auto-fix.yml` が自動更新する。**本文を手で編集しない**',
    '（JSON が壊れるとループは安全側に倒れて停止する）。仕組みの説明は `docs/auto-fix-loop-guide.md`。',
    '',
    `## ${month} の予算`,
    '',
    '| 項目 | 値 |',
    '| --- | --- |',
    `| 月額上限 | ¥${budgetJpy}（= $${cap.toFixed(2)} / 為替 ¥${jpyPerUsd}） |`,
    `| 使用 | $${used.toFixed(2)}（¥${Math.round(used * jpyPerUsd)}） · ${pct}% |`,
    `| 残り | $${remaining.toFixed(2)}（¥${Math.round(remaining * jpyPerUsd)}） |`,
    `| 実行回数 | ${(ledger.months?.[month]?.runs ?? []).length} 回 |`,
    '',
    `## ${month} の実行履歴`,
    '',
  ];

  if (runs.length === 0) {
    lines.push('_まだ実行がない。_');
  } else {
    lines.push('| 日時 (JST) | 種別 | 費用 | 結果 |', '| --- | --- | --- | --- |');
    for (const r of runs) {
      lines.push(
        `| ${jst(r.at)} | ${r.kind ?? '-'} | $${(r.costUsd ?? 0).toFixed(3)} | ${r.result ?? '-'} |`,
      );
    }
  }

  lines.push(
    '',
    '<details><summary>台帳データ（機械可読・編集しない）</summary>',
    '',
    FENCE_OPEN,
    JSON.stringify(ledger, null, 2),
    FENCE_CLOSE,
    '',
    '</details>',
  );
  return lines.join('\n');
}

function jst(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return new Date(d.getTime() + 9 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 16);
}

// ── CLI ────────────────────────────────────────────────────────────────────

function arg(name, fallback = undefined) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1 || i === process.argv.length - 1) return fallback;
  return process.argv[i + 1];
}

function readIfExists(path) {
  if (!path) return '';
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return '';
  }
}

function emit(outputs) {
  const text = Object.entries(outputs)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  console.log(text);
  if (process.env.GITHUB_OUTPUT) {
    writeFileSync(process.env.GITHUB_OUTPUT, `${text}\n`, { flag: 'a' });
  }
}

function main() {
  const command = process.argv[2];
  const budgetJpy = Number(arg('budget-jpy', '500'));
  const jpyPerUsd = Number(arg('jpy-per-usd', '170'));
  const cap = capUsd({ budgetJpy, jpyPerUsd });
  const month = monthKey();

  if (command === 'plan') {
    // 「台帳がまだ無い（本文が空）」と「台帳が壊れている」は区別する。
    // 前者は初回なので空の台帳として進み、後者は安全側で停止する。
    const bodyText = readIfExists(arg('body-file'));
    const ledger = bodyText.trim() === '' ? EMPTY_LEDGER : parseLedger(bodyText);
    const result = plan({
      ledger,
      month,
      capUsd: cap,
      perRunCapUsd: Number(arg('per-run-usd', '0.6')),
      reservePct: Number(arg('reserve-pct', '30')),
      minRunUsd: Number(arg('min-run-usd', '0.15')),
      maxBarren: Number(arg('max-barren', '3')),
      kind: arg('kind', 'sweep'),
    });
    emit({
      allowed: String(result.allowed),
      budget_usd: result.budgetUsd.toFixed(2),
      remaining_usd: result.remainingUsd.toFixed(2),
      month,
      cap_usd: cap.toFixed(2),
      reason: result.reason,
    });
    return;
  }

  if (command === 'init') {
    // 台帳 Issue の初期本文。空の台帳を「壊れている」と誤認させないため、
    // 本文の生成は必ずこの経路を通す（手書きしない）。
    writeFileSync(
      arg('out', 'ledger-body.md'),
      renderIssueBody(EMPTY_LEDGER, { capUsd: cap, budgetJpy, jpyPerUsd, month }),
    );
    return;
  }

  if (command === 'record') {
    const bodyText = readIfExists(arg('body-file'));
    const ledger = bodyText.trim() === '' ? EMPTY_LEDGER : (parseLedger(bodyText) ?? EMPTY_LEDGER);
    const measured = extractCostUsd(readIfExists(arg('execution-file')));
    // 費用が読めなかったら、この実行に渡した上限を使ったものとして計上する。
    // 過少計上は上限を静かに突破させるため、必ず多い側に倒す。
    const fallback = Number(arg('fallback-usd', '0'));
    const costUsd = measured ?? fallback;
    const next = recordRun(ledger, month, {
      at: new Date().toISOString(),
      kind: arg('kind', 'sweep'),
      costUsd: round(costUsd),
      estimated: measured === null,
      run: process.env.GITHUB_RUN_ID ?? null,
      result: arg('result', '-'),
    });
    writeFileSync(arg('out', 'ledger-body.md'), renderIssueBody(next, { capUsd: cap, budgetJpy, jpyPerUsd, month }));
    emit({
      cost_usd: costUsd.toFixed(4),
      cost_estimated: String(measured === null),
      spent_usd: spentUsd(next, month).toFixed(4),
    });
    return;
  }

  console.error('usage: bot-budget.mjs <init|plan|record> [options]');
  process.exit(2);
}

// CLI として起動されたときだけ実行する（テストから import しても走らないように）。
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
