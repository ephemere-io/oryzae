// @oryzae/verify — Replay 録画スクリプト（Playwright）。
//
//   pnpm --filter @oryzae/client verify:record                 # 全ユニットを録画 → recordings/replay-all-<ts>.webm
//   pnpm --filter @oryzae/client verify:record --unit LandingFaqItem   # 1 ユニットだけ（#371 の全green デモ用）
//   pnpm --filter @oryzae/client verify:record --dwell 1200    # 各 fixture の保持時間を調整
//   pnpm --filter @oryzae/client verify:record --headed        # 録画中のブラウザを表示
//
// 前提:
//   - dev サーバが :3000 で起動していること（別ターミナルで `pnpm --filter @oryzae/client dev`）。
//     /verify/* は dev 限定（本番は 404）なので production ビルドでは録れない。
//   - Playwright の chromium が install 済みであること（`pnpm --filter @oryzae/client exec playwright install chromium`）。
//
// 仕組み: Playwright の recordVideo 付き context で /verify/replay を開き、
// window.__verify_replay.done を待ってから context を閉じて .webm を確定・改名する。
// これは「記録済み結果の再生」ではなく毎回ライブ再実行を録画する（CI ゲートと同じ runFixture 経路）。

import { mkdirSync, readdirSync, renameSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const args = parseArgs(process.argv.slice(2));
const DWELL = Number(args.dwell ?? 1500);
const KEY = Number(args.key ?? 60);
const UNIT = args.unit ? String(args.unit) : null;
const BASE = String(args.base ?? 'http://localhost:3000');
const HEADED = Boolean(args.headed);
const OUT_DIR = String(args.out ?? 'recordings');
const SIZE = { width: 1280, height: 900 };
const URL =
  String(args.url ?? '') ||
  `${BASE}/verify/replay?dwell=${DWELL}&key=${KEY}&auto=1${UNIT ? `&unit=${encodeURIComponent(UNIT)}` : ''}`;

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const before = new Set(safeLs(OUT_DIR));

  console.log(`▶ launching chromium → ${URL}`);
  const browser = await chromium.launch({ headless: !HEADED });
  const context = await browser.newContext({
    viewport: SIZE,
    recordVideo: { dir: OUT_DIR, size: SIZE },
  });
  const page = await context.newPage();

  await page.goto(URL, { waitUntil: 'networkidle' });

  console.log('⏺ recording — waiting for window.__verify_replay.done …');
  await page.waitForFunction(() => window.__verify_replay?.done === true, null, {
    timeout: 10 * 60_000,
  });
  // サマリ画面を少し映しておく。
  await page.waitForTimeout(1200);

  // 閉じる前に構造化結果を取得。
  const results = await page.evaluate(() => window.__verify_replay?.results ?? []);

  // context を閉じると動画ファイルが確定する。
  await context.close();
  await browser.close();

  // Playwright が書いた新規ファイルを探して改名する。
  const after = safeLs(OUT_DIR).filter((f) => !before.has(f));
  const newest =
    after.sort(
      (a, b) => statSync(join(OUT_DIR, b)).mtimeMs - statSync(join(OUT_DIR, a)).mtimeMs,
    )[0] ?? null;
  if (!newest) {
    console.error(
      '✖ no video file produced — is chromium installed? (playwright install chromium)',
    );
    process.exit(1);
  }
  const finalName = `replay-${UNIT ?? 'all'}-${stamp()}.webm`;
  renameSync(join(OUT_DIR, newest), join(OUT_DIR, finalName));

  const s = summarize(results);
  console.log(
    `✔ saved ${join(OUT_DIR, finalName)}  (${s.pass} pass / ${s.fail} fail / ${s.blocked} blocked of ${s.total})`,
  );
  if (s.fail > 0) {
    console.warn(`⚠ ${s.fail} fixture(s) FAILED — この録画は「全green」ではない。`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/* helpers */

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
      out[key] = val;
    }
  }
  return out;
}

function safeLs(dir) {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function summarize(results) {
  return {
    total: results.length,
    pass: results.filter((r) => r.verdict === 'PASS').length,
    fail: results.filter((r) => r.verdict === 'FAIL').length,
    blocked: results.filter((r) => r.verdict === 'BLOCKED').length,
  };
}
