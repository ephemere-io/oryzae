#!/usr/bin/env node
// Build messages/{ja,en}.json from the i18n CSV.
//
// Source priority:
//   1. ORYZAE_I18N_CSV_URL env var (remote CSV URL)
//   2. --csv=<path> CLI flag (local CSV)
//   3. ../../.tmp/i18n-inventory.csv relative to this script (fallback for dev)
//
// CSV columns: key,ja,en,file,line,context
// Keys are dot-separated paths (e.g. "auth.callback.error_auth_failed").

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MESSAGES_DIR = resolve(__dirname, '../src/i18n/messages');
const FALLBACK_CSV = resolve(__dirname, '../../../.tmp/i18n-inventory.csv');

const SHEETS_URL =
  process.env.ORYZAE_I18N_CSV_URL ??
  'https://docs.google.com/spreadsheets/d/1GThXIAh0ZsIl5POxyLKYfSulz2Y_f1rBpTzSL98brkY/export?format=csv&gid=1897706581';

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        row.push(field);
        field = '';
      } else if (c === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else if (c === '\r') {
        // skip; \n will close the row
      } else {
        field += c;
      }
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function setNested(target, dottedKey, value) {
  const parts = dottedKey.split('.');
  let cur = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (typeof cur[part] !== 'object' || cur[part] === null || Array.isArray(cur[part])) {
      cur[part] = {};
    }
    cur = cur[part];
  }
  cur[parts[parts.length - 1]] = value;
}

async function loadCsv() {
  const cliArg = process.argv.find((a) => a.startsWith('--csv='));
  if (cliArg) {
    const p = cliArg.slice('--csv='.length);
    return readFileSync(p, 'utf8');
  }
  if (process.env.ORYZAE_I18N_CSV_URL || process.argv.includes('--remote')) {
    const res = await fetch(SHEETS_URL);
    if (!res.ok) {
      throw new Error(`Failed to fetch CSV from ${SHEETS_URL}: ${res.status} ${res.statusText}`);
    }
    return await res.text();
  }
  return readFileSync(FALLBACK_CSV, 'utf8');
}

async function main() {
  const csvText = await loadCsv();
  const rows = parseCsv(csvText);
  if (rows.length === 0) {
    throw new Error('CSV is empty');
  }
  const header = rows[0];
  const idx = {
    key: header.indexOf('key'),
    ja: header.indexOf('ja'),
    en: header.indexOf('en'),
  };
  if (idx.key === -1 || idx.ja === -1 || idx.en === -1) {
    throw new Error(`CSV header must include key/ja/en. Got: ${header.join(',')}`);
  }

  const ja = {};
  const en = {};
  let count = 0;
  const seenKeys = new Set();
  const dupes = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.length === 0 || (row.length === 1 && row[0] === '')) continue;
    const key = row[idx.key]?.trim();
    if (!key) continue;
    if (seenKeys.has(key)) dupes.push(key);
    seenKeys.add(key);
    setNested(ja, key, row[idx.ja] ?? '');
    setNested(en, key, row[idx.en] ?? '');
    count++;
  }

  mkdirSync(MESSAGES_DIR, { recursive: true });
  writeFileSync(resolve(MESSAGES_DIR, 'ja.json'), `${JSON.stringify(ja, null, 2)}\n`);
  writeFileSync(resolve(MESSAGES_DIR, 'en.json'), `${JSON.stringify(en, null, 2)}\n`);

  console.log(`Wrote ${count} keys to ${MESSAGES_DIR}/ja.json and en.json`);
  if (dupes.length > 0) {
    console.warn(
      `Warning: ${dupes.length} duplicate keys (last wins): ${dupes.slice(0, 5).join(', ')}${dupes.length > 5 ? '...' : ''}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
