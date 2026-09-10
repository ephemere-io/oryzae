import { describe, expect, it } from 'vitest';
import { classify, parseNameStatus } from './bot-change-policy.mjs';

/**
 * 自動マージ範囲ゲート自体のテスト。
 *
 * このゲートは「人が誰も見ない差分」を通すかどうかを決める最後の判断であり、
 * 緩んだことに気づけるのは、通ってはいけない変更が main に入った後になる。
 * したがって「通ること」より **「止まること」** を厚く固定する。
 */

const of = (...pairs) => classify(pairs.map(([status, path]) => ({ status, path })));
const verdictOf = (...pairs) => of(...pairs).verdict;

describe('parseNameStatus', () => {
  it('追加・変更・削除を読む', () => {
    const out = parseNameStatus('M\tapps/server/src/a.ts\nA\tapps/server/test/a.test.ts\nD\tdocs/old.md\n');
    expect(out).toEqual([
      { status: 'M', path: 'apps/server/src/a.ts' },
      { status: 'A', path: 'apps/server/test/a.test.ts' },
      { status: 'D', path: 'docs/old.md' },
    ]);
  });

  it('リネームは新しいパスの追加として扱う', () => {
    expect(parseNameStatus('R100\tapps/client/src/old.ts\tapps/client/src/new.ts')).toEqual([
      { status: 'R', path: 'apps/client/src/new.ts' },
    ]);
  });

  it('空入力・空行を落とす', () => {
    expect(parseNameStatus('')).toEqual([]);
    expect(parseNameStatus('\n\n')).toEqual([]);
    expect(parseNameStatus(null)).toEqual([]);
  });
});

describe('通ってよい差分', () => {
  it('サーバー実装とテスト', () => {
    expect(
      verdictOf(
        ['M', 'apps/server/src/contexts/entry/application/create-entry.ts'],
        ['A', 'apps/server/test/contexts/entry/create-entry.test.ts'],
      ),
    ).toBe('auto-merge');
  });

  it('クライアント実装（既存コンポーネントの修正）', () => {
    expect(
      verdictOf(
        ['M', 'apps/client/src/features/sp/entries/components/entry-list.tsx'],
        ['M', 'apps/client/src/features/shared/entries/use-entries.ts'],
      ),
    ).toBe('auto-merge');
  });

  it('共有パッケージ・E2E・設計ドキュメント', () => {
    expect(
      verdictOf(
        ['M', 'packages/shared/src/schemas/entry.ts'],
        ['M', 'apps/client/e2e/signup.spec.ts'],
        ['M', 'docs/entry-backend-guide.md'],
      ),
    ).toBe('auto-merge');
  });

  it('変更が無ければ empty', () => {
    expect(classify([]).verdict).toBe('empty');
    expect(classify(null).verdict).toBe('empty');
  });
});

describe('止めるべき差分 — 許可領域の外', () => {
  it.each([
    ['supabase/migrations/20260903_add_table.sql', 'マイグレーション'],
    ['.github/workflows/ci.yml', 'CI ワークフロー'],
    ['.github/workflows/auto-fix.yml', '自分自身のワークフロー'],
    ['.github/dependabot.yml', 'dependabot 設定'],
    ['package.json', 'ルートの依存とフック定義'],
    ['pnpm-lock.yaml', 'lockfile'],
    ['scripts/check-rls-policies.mjs', 'RLS ゲート本体'],
    ['scripts/bot-change-policy.mjs', 'このゲート自身'],
    ['CLAUDE.md', 'ハーネスの指示'],
    ['.claude/rules/quality.md', 'ハーネスの指示'],
    ['biome.json', 'lint 設定'],
    ['knip.json', 'デッドコード検出設定'],
    ['apps/client/tsconfig.json', '型設定'],
    ['apps/client/next.config.ts', 'ビルド設定'],
    ['apps/client/sentry.client.config.ts', '監視設定'],
    ['.env.example', '環境変数'],
    ['.gitleaks.toml', 'secret スキャン設定'],
    ['supabase/rls-baseline.json', 'RLS の既知リスク台帳'],
  ])('%s を止める（%s）', (path) => {
    expect(verdictOf(['M', path])).toBe('blocked');
  });

  it('許可領域と混在していても止める', () => {
    const result = of(
      ['M', 'apps/server/src/contexts/entry/application/create-entry.ts'],
      ['A', 'supabase/migrations/20260903_x.sql'],
    );
    expect(result.verdict).toBe('blocked');
    expect(result.reasons.join('\n')).toContain('supabase/migrations/20260903_x.sql');
  });
});

describe('止めるべき差分 — 許可領域の内側にある急所', () => {
  it('ユーザー向け文言（i18n メッセージ）', () => {
    expect(verdictOf(['M', 'apps/client/src/i18n/messages/ja.json'])).toBe('blocked');
  });

  it('認可ミドルウェア', () => {
    expect(
      verdictOf(['M', 'apps/server/src/contexts/shared/presentation/middleware/auth.ts']),
    ).toBe('blocked');
  });

  it('service role クライアント', () => {
    expect(
      verdictOf(['M', 'apps/server/src/contexts/shared/infrastructure/supabase-client.ts']),
    ).toBe('blocked');
  });

  it('dependency-cruiser のルール', () => {
    expect(verdictOf(['M', 'apps/server/.dependency-cruiser.cjs'])).toBe('blocked');
  });

  it('Next.js middleware', () => {
    expect(verdictOf(['M', 'apps/client/src/middleware.ts'])).toBe('blocked');
  });

  it('監視の初期化', () => {
    expect(verdictOf(['M', 'apps/client/src/instrumentation.ts'])).toBe('blocked');
  });

  it('理由に「なぜ止めたか」が入る', () => {
    const { reasons } = of(['M', 'apps/client/src/i18n/messages/ja.json']);
    expect(reasons[0]).toContain('ユーザー向け文言');
  });
});

describe('新規 client コンポーネントの追加は止める（検証ハーネス必須の領域）', () => {
  it('追加は止める', () => {
    expect(verdictOf(['A', 'apps/client/src/features/pc/board/components/sticky-note.tsx'])).toBe(
      'blocked',
    );
  });

  it('同じパスでも既存の修正なら通す', () => {
    expect(verdictOf(['M', 'apps/client/src/features/pc/board/components/sticky-note.tsx'])).toBe(
      'auto-merge',
    );
  });

  // CI の verify-coverage-gate も `-M` でリネームを除外している。
  // ここで止めると「移設しただけで人待ちになる」ため、CI 側と揃えて通す。
  it('リネーム（移設）は新規追加とみなさず通す（CI のゲートと同じ扱い）', () => {
    expect(verdictOf(['R', 'apps/client/src/features/pc/board/components/sticky-note.tsx'])).toBe(
      'auto-merge',
    );
  });

  it('admin の新規コンポーネントは検証ハーネス対象外なので通す', () => {
    expect(verdictOf(['A', 'apps/admin/src/features/users/components/user-row.tsx'])).toBe(
      'auto-merge',
    );
  });
});

describe('差分の広さ', () => {
  it('ファイル数が上限を超えたら止める', () => {
    const many = Array.from({ length: 16 }, (_, i) => ({
      status: 'M',
      path: `apps/server/src/contexts/entry/application/u${i}.ts`,
    }));
    const result = classify(many);
    expect(result.verdict).toBe('blocked');
    expect(result.reasons[0]).toContain('広すぎる');
  });

  it('上限ちょうどは通す', () => {
    const many = Array.from({ length: 15 }, (_, i) => ({
      status: 'M',
      path: `apps/server/src/contexts/entry/application/u${i}.ts`,
    }));
    expect(classify(many).verdict).toBe('auto-merge');
  });

  it('上限は差し替えられる', () => {
    const two = [
      { status: 'M', path: 'apps/server/src/a.ts' },
      { status: 'M', path: 'apps/server/src/b.ts' },
    ];
    expect(classify(two, { maxFiles: 1 }).verdict).toBe('blocked');
  });
});
