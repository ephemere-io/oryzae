import { describe, expect, it } from 'vitest';
import { collectFindings, replay } from './check-rls-policies.mjs';

/**
 * RLS ゲート自体のテスト。
 *
 * このゲートは「他人の日記が読めるか」を守る最後の決定的な防衛線であり、
 * 壊れても静かに緑を返すだけなので気づけない。だから検出できることと同じくらい
 * 「検出漏れしないこと」をテストで固定する。
 */

/** SQL 断片から findings の id 配列を得る。 */
const idsOf = (...sqls) =>
  collectFindings(replay(sqls.map((sql, i) => ({ file: `m/${i}.sql`, sql })))).map((f) => f.id);

const OK_TABLE = `
  create table entries (id uuid primary key, user_id uuid not null);
  alter table entries enable row level security;
  create policy "entries_own" on entries for all using (user_id = auth.uid());
`;

describe('健全なマイグレーション', () => {
  it('問題を報告しない', () => {
    expect(idsOf(OK_TABLE)).toEqual([]);
  });

  it('所有者を辿るサブクエリも auth.uid() 参照として認める', () => {
    const sql = `
      create table entry_snapshots (id uuid primary key, entry_id uuid not null);
      alter table entry_snapshots enable row level security;
      create policy "snap_own" on entry_snapshots for select using (
        entry_id in (select id from entries where user_id = auth.uid())
      );
    `;
    expect(idsOf(sql)).toEqual([]);
  });
});

describe('ルール1: RLS 未有効のテーブル', () => {
  it('検出する', () => {
    const sql = 'create table diary_notes (id uuid primary key, user_id uuid not null);';
    expect(idsOf(sql)).toContain('table-without-rls:diary_notes');
  });

  it('public. 接頭辞の有無で取り違えない', () => {
    const sql = `
      create table public.entries (id uuid primary key);
      alter table entries enable row level security;
      create policy "p" on public.entries for all using (user_id = auth.uid());
    `;
    expect(idsOf(sql)).toEqual([]);
  });
});

describe('ルール2: ポリシーが 1 つも無い', () => {
  it('検出する', () => {
    const sql = `
      create table orphan (id uuid primary key);
      alter table orphan enable row level security;
    `;
    expect(idsOf(sql)).toContain('rls-without-policy:orphan');
  });
});

describe('ルール3: TO 句なしの USING (true)', () => {
  it('検出する', () => {
    const sql = `
      create table profiles (id uuid primary key);
      alter table profiles enable row level security;
      create policy "svc" on profiles for all using (true);
    `;
    expect(idsOf(sql)).toContain('unconditional-policy:profiles:svc');
  });

  it('TO service_role が明示されていれば許す', () => {
    const sql = `
      create table profiles (id uuid primary key);
      alter table profiles enable row level security;
      create policy "svc" on profiles for all to service_role using (true);
      create policy "own" on profiles for select using (id = auth.uid());
    `;
    expect(idsOf(sql)).toEqual([]);
  });

  it('own-data ポリシーが併存していても USING (true) を見逃さない', () => {
    // permissive ポリシーは OR 結合されるので、own-data があっても全開になる。
    // 「隣に正しいポリシーがあるから安全」と誤判定しないことを固定する。
    const sql = `
      create table profiles (id uuid primary key);
      alter table profiles enable row level security;
      create policy "own" on profiles for select using (id = auth.uid());
      create policy "svc" on profiles for all using (true);
    `;
    expect(idsOf(sql)).toContain('unconditional-policy:profiles:svc');
  });
});

describe('ルール4: 読み取りのユーザー隔離', () => {
  it('USING (true) ではないが auth.uid() も参照しないポリシーを検出する', () => {
    // storage.objects だけを見ていた頃はここが素通りしていた（検出漏れの回帰テスト）
    const sql = `
      create table entries (id uuid primary key, is_published boolean);
      alter table entries enable row level security;
      create policy "pub_read" on entries for select using (is_published = true);
    `;
    expect(idsOf(sql)).toContain('select-unscoped:entries:pub_read');
  });

  it('ルール3 と二重計上しない', () => {
    const sql = `
      create table t (id uuid primary key);
      alter table t enable row level security;
      create policy "p" on t for all using (true);
    `;
    const ids = idsOf(sql);
    expect(ids).toContain('unconditional-policy:t:p');
    expect(ids).not.toContain('select-unscoped:t:p');
  });

  it('storage の SELECT にユーザー隔離が無いと検出する', () => {
    const sql = `create policy "photos_read" on storage.objects for select using (bucket_id = 'photos');`;
    expect(idsOf(sql)).toContain('storage-select-unscoped:photos_read');
  });

  it('public バケットを検出する', () => {
    const sql = `insert into storage.buckets (id, name, public) values ('photos', 'photos', true);`;
    expect(idsOf(sql)).toContain('public-bucket:photos');
  });

  it('public 列を省略したバケットは非公開扱いにする', () => {
    const sql = `insert into storage.buckets (id, name) values ('private', 'private');`;
    expect(idsOf(sql)).not.toContain('public-bucket:private');
  });

  it('列の並び順が違っても public を取り違えない', () => {
    // 位置ではなく列名で対応づけていることの確認
    const sql = `insert into storage.buckets (public, id, name) values (false, 'x', 'true');`;
    expect(idsOf(sql)).not.toContain('public-bucket:x');
  });
});

describe('再生セマンティクス', () => {
  it('後続マイグレーションの DROP POLICY で解消される', () => {
    const bad = `
      create table t (id uuid primary key);
      alter table t enable row level security;
      create policy "leak" on t for all using (true);
    `;
    const fix = `
      drop policy "leak" on t;
      create policy "own" on t for all using (id = auth.uid());
    `;
    expect(idsOf(bad)).toContain('unconditional-policy:t:leak');
    expect(idsOf(bad, fix)).toEqual([]);
  });

  it('DROP TABLE されたテーブルは報告しない', () => {
    expect(idsOf('create table tmp (id uuid primary key);', 'drop table tmp;')).toEqual([]);
  });

  it('バケットを後から private 化すると解消される', () => {
    const create = `insert into storage.buckets (id, name, public) values ('b', 'b', true);`;
    const fix = `update storage.buckets set public = false where id = 'b';`;
    expect(idsOf(create)).toContain('public-bucket:b');
    expect(idsOf(create, fix)).not.toContain('public-bucket:b');
  });
});

describe('@rls-exempt', () => {
  it('直前行の宣言を認める', () => {
    const sql = `
      -- @rls-exempt: アバターは公開画像
      insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true);
    `;
    expect(idsOf(sql)).toEqual([]);
  });

  it('間にコメント行が挟まっても拾う', () => {
    const sql = `
      -- @rls-exempt: アバターは公開画像
      -- 補足コメント
      insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true);
    `;
    expect(idsOf(sql)).toEqual([]);
  });

  it('宣言が無ければ免除しない', () => {
    const sql = `insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true);`;
    expect(idsOf(sql)).toContain('public-bucket:avatars');
  });
});

describe('SQL パース', () => {
  it('括弧を含む条件式でも文の終端を誤らない', () => {
    const sql = `
      create table t (id uuid primary key);
      alter table t enable row level security;
      create policy "own" on t for select using (
        id in (select unnest(array[auth.uid()]))
      );
    `;
    expect(idsOf(sql)).toEqual([]);
  });

  it('文字列リテラル中のセミコロンで分断されない', () => {
    const sql = `
      create table t (id uuid primary key, note text default 'a;b');
      alter table t enable row level security;
      create policy "own" on t for all using (id = auth.uid());
    `;
    expect(idsOf(sql)).toEqual([]);
  });
});
