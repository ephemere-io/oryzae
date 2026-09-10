#!/usr/bin/env node
/**
 * 自動実行の一覧が実態とずれていないかを検査する。
 *
 * なぜ必要か:
 * `apps/admin/src/features/automation/inventory.ts` は「勝手に回っているもの」を
 * 人が読める形で並べた一覧で、admin の画面に出る。だが手で書く以上、
 * **ワークフローを足したときに書き忘れる**。そして書き忘れても何も壊れないので、
 * 気づけない。気づけないまま「一覧に無い自動実行」が増えるのが最悪の状態である
 * （把握できていないものは止められない）。
 *
 * そこで `.github/workflows/*.yml` と `.github/dependabot.yml` を実際に読み、
 * 一覧の `definedIn` と突き合わせる。
 *
 * 検査する不変条件:
 *   1. 自動起動を持つワークフローは、すべて一覧に載っている
 *      （schedule / workflow_run / issues / push / pull_request のいずれか）
 *   2. dependabot.yml があれば一覧に載っている
 *   3. 一覧に、もう存在しないファイルを指す項目が無い（一覧の腐敗防止）
 *   4. schedule を持つワークフローは、一覧のどれかが schedule を宣言している
 *      （「定期実行があるのに一覧上は単発扱い」を防ぐ）
 *
 * 人が起動するしかないもの（workflow_dispatch だけ）は対象外。
 * 勝手に回らないので「把握しておくべき自動実行」ではない。
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOWS_DIR = join(ROOT, '.github', 'workflows');
const DEPENDABOT = join(ROOT, '.github', 'dependabot.yml');
const INVENTORY = join(ROOT, 'apps', 'admin', 'src', 'features', 'automation', 'inventory.ts');

/** 人が起動しなくても発火するトリガー。 */
const AUTO_TRIGGERS = ['schedule', 'workflow_run', 'issues', 'push', 'pull_request', 'issue_comment'];

/**
 * `on:` ブロックに現れるトリガー名を拾う。
 *
 * YAML パーサを持ち込まずに済ませている。ここで見たいのは「トリガー名が
 * 書かれているか」だけで、構造を正確に復元する必要が無いため。
 * ただし `on:` の外にある同名の語を拾わないよう、インデント 2 の見出しに限定する。
 */
export function extractTriggers(yaml) {
  const lines = String(yaml ?? '').split('\n');
  const triggers = [];
  let inOn = false;
  for (const line of lines) {
    if (/^on:\s*$/.test(line) || /^on:\s*\S/.test(line)) {
      inOn = true;
      // `on: [push, pull_request]` のような 1 行形式
      const inline = line.slice(3).trim();
      if (inline.startsWith('[')) {
        for (const t of inline.replace(/[[\]]/g, '').split(',')) {
          const name = t.trim();
          if (name) triggers.push(name);
        }
        inOn = false;
      }
      continue;
    }
    if (!inOn) continue;
    // インデントが戻ったら `on:` ブロックの外
    if (/^\S/.test(line) && line.trim() !== '') {
      inOn = false;
      continue;
    }
    const m = line.match(/^ {2}([a-z_]+):/);
    if (m) triggers.push(m[1]);
  }
  return [...new Set(triggers)];
}

/** ワークフローが「勝手に回る」かどうか。 */
export function isAutomatic(triggers) {
  return triggers.some((t) => AUTO_TRIGGERS.includes(t));
}

/** inventory.ts から definedIn の値を拾う。 */
export function extractDefinedIn(source) {
  return [...String(source ?? '').matchAll(/definedIn:\s*'([^']+)'/g)].map((m) => m[1]);
}

/** inventory.ts で schedule を宣言している definedIn を拾う。 */
export function extractScheduledDefinedIn(source) {
  const text = String(source ?? '');
  const scheduled = [];
  // 1 項目 = `{` から対応する `},` まで、という単純な切り出しで足りる形に保っている。
  for (const block of text.split(/\n {2}\{\n/).slice(1)) {
    const definedIn = block.match(/definedIn:\s*'([^']+)'/)?.[1];
    if (!definedIn) continue;
    const schedule = block.match(/schedule:\s*(null|'[^']*')/)?.[1];
    if (schedule && schedule !== 'null') scheduled.push(definedIn);
  }
  return scheduled;
}

export function collectFindings({ workflows, dependabotExists, inventorySource }) {
  const findings = [];
  const listed = new Set(extractDefinedIn(inventorySource));
  const listedScheduled = new Set(extractScheduledDefinedIn(inventorySource));

  for (const { path, triggers } of workflows) {
    if (!isAutomatic(triggers)) continue;
    if (!listed.has(path)) {
      findings.push({
        id: `missing:${path}`,
        message: `${path} は自動で起動する（${triggers.join(' / ')}）のに、一覧に載っていない。apps/admin/src/features/automation/inventory.ts に追加すること。`,
      });
      continue;
    }
    if (triggers.includes('schedule') && !listedScheduled.has(path)) {
      findings.push({
        id: `schedule-not-declared:${path}`,
        message: `${path} は schedule を持つのに、一覧の該当項目が schedule: null になっている。定期実行の時刻を書くこと。`,
      });
    }
  }

  if (dependabotExists && !listed.has('.github/dependabot.yml')) {
    findings.push({
      id: 'missing:.github/dependabot.yml',
      message:
        'dependabot が設定されているのに一覧に載っていない。apps/admin/src/features/automation/inventory.ts に追加すること。',
    });
  }

  const known = new Set([...workflows.map((w) => w.path), '.github/dependabot.yml']);
  for (const path of listed) {
    if (!known.has(path)) {
      findings.push({
        id: `stale:${path}`,
        message: `一覧が ${path} を指しているが、そのファイルは存在しない。項目を削除すること。`,
      });
    }
  }

  return findings;
}

function readWorkflows() {
  if (!existsSync(WORKFLOWS_DIR)) return [];
  return readdirSync(WORKFLOWS_DIR)
    .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
    .map((f) => ({
      path: `.github/workflows/${f}`,
      triggers: extractTriggers(readFileSync(join(WORKFLOWS_DIR, f), 'utf8')),
    }));
}

function main() {
  if (!existsSync(INVENTORY)) {
    console.error(`✗ 一覧が見つかりません: ${INVENTORY}`);
    process.exit(1);
  }
  const workflows = readWorkflows();
  const findings = collectFindings({
    workflows,
    dependabotExists: existsSync(DEPENDABOT),
    inventorySource: readFileSync(INVENTORY, 'utf8'),
  });

  const automatic = workflows.filter((w) => isAutomatic(w.triggers));
  if (findings.length > 0) {
    console.error(`\n✗ 自動実行の一覧が実態とずれています（${findings.length} 件）\n`);
    for (const f of findings) console.error(`  ${f.message}\n`);
    process.exit(1);
  }
  console.log(
    `✓ 自動実行の一覧: 実態と一致（自動起動 ${automatic.length} 本 + dependabot ${existsSync(DEPENDABOT) ? 1 : 0} 件）`,
  );
}

// CLI として起動されたときだけ実行する（テストから import しても走らないように）。
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
