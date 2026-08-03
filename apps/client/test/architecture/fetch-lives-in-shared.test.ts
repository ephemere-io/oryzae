import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// データ取得・更新（fetch）は features/shared / lib / app/api にだけ置く。
// （doc: client-architecture-guide.md「置き場の決定木」3）
//
// なぜ機械強制するか: pc/sp/flat/app に fetch が生えると、reach 分離に阻まれて端末間で
// 共有できず、必ずコピーが発生する。Issue #490 では fermentation detail の取得が 3実装、
// profile 更新が 2実装に増殖し、page が API を直叩きして features/shared が空洞化した。
// dep-cruiser は import しか見ないので、エンドポイント文字列はここで見る。

const SRC = 'src';
const ALLOWED_PREFIXES = ['src/features/shared/', 'src/lib/', 'src/app/api/'];

/**
 * 移行中の既知違反（Issue #490 Phase 2〜5 で解消する）。
 *
 * **このリストは減る一方でなければならない。** 追加は新たな負債の追認なのでレビューで止める。
 * 解消したら必ず削除すること。消し忘れは下の「陳腐化した allowlist を残さない」が検出する。
 */
const MIGRATING: string[] = [
  // Phase 5 で解消: app/ の API 直叩き
  'src/app/(auth)/auth/confirm/page.tsx',
  'src/app/(auth)/callback/page.tsx',
  'src/app/(protected)/entries/new/page.tsx',
  'src/app/(protected)/jar/page.tsx',
  // Phase 3 で解消: account/profile の二重実装
  'src/features/auth/components/account-page.tsx',
  'src/features/sp/account/components/sp-account-page.tsx',
  // Phase 5 で解消: 認証フォームの直叩き
  'src/features/auth/components/forgot-password-form.tsx',
  'src/features/auth/components/google-login-button.tsx',
  'src/features/auth/components/reset-password-form.tsx',
];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

/** コメント中のエンドポイント言及（verify-exempt の説明文など）を誤検出しないため。 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function findViolations(): string[] {
  return (
    walk(SRC)
      .filter((f) => /\.tsx?$/.test(f))
      // verify ハーネスの fixture は本番経路ではない（fetch をスタブする側）ので対象外。
      .filter((f) => !f.endsWith('.verify.tsx'))
      .filter((f) => !ALLOWED_PREFIXES.some((p) => f.startsWith(p)))
      .filter((f) => /\/api\/v1\//.test(stripComments(readFileSync(f, 'utf8'))))
      .sort()
  );
}

describe('fetch は features/shared に集約する', () => {
  it('features/shared・lib・app/api の外に /api/v1 の呼び出しが無い', () => {
    const unexpected = findViolations().filter((f) => !MIGRATING.includes(f));
    expect(unexpected).toEqual([]);
  });

  it('陳腐化した allowlist を残さない（直したら MIGRATING から消す）', () => {
    const violations = findViolations();
    const stale = MIGRATING.filter((f) => !violations.includes(f));
    expect(stale).toEqual([]);
  });
});
