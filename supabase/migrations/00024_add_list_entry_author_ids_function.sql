-- 発酵の対象ユーザー抽出を DB 側の distinct に寄せる（issue #621）。
--
-- これまで cron / admin の手動トリガーは entries を `.limit(1000)` で読み、JS 側で
-- Set にして distinct を取っていた。1000 は PostgREST の 1 レスポンス上限と同値で、
-- しかも効くのは **ユーザー数ではなくエントリー行数**。エントリー総数が 1000 を
-- 超えた時点で、一部のユーザーがエラーも警告も出さずに発酵対象から消える
-- （#367 と同じ壊れ方。ORDER BY が無いので消えるのは新しい側 ≒ 新規ユーザー）。
--
-- distinct を DB 側で解決すれば、返る行数は「書いたことがあるユーザー数」の
-- オーダーになり、エントリーが何万行に増えても関係なくなる。**行数上限との
-- 追いかけっこが構造的に終わる**のがこの案の要点。
--
-- そのうえで user_id のカーソル引数を持たせ、**ユーザー数**が 1 レスポンス上限を
-- 超えた場合も辿り切れるようにする（呼び出し側は空ページが返るまで読む）。
--
-- security definer にはしない。definer にすると呼び出したロールに関係なく全ユーザーの
-- user_id が返り、authenticated な誰かがこの関数を叩くだけで利用者一覧を列挙できる。
-- invoker のままなら entries の RLS（00001 の entries_own_data: user_id = auth.uid()）が
-- そのまま効き、RLS をバイパスする service role で呼んだときだけ全件が返る。
create or replace function public.list_entry_author_ids(
  after_user_id uuid default null,
  page_size int default 1000
)
returns table (author_id uuid)
language sql
stable
security invoker
set search_path = public
as $$
  select distinct e.user_id
  from public.entries e
  where after_user_id is null or e.user_id > after_user_id
  order by 1
  -- 上限を固定する。呼び出し側が大きな値を渡しても PostgREST 側の上限で黙って
  -- 切られるだけなので、ここで意図した粒度に丸めておく。
  limit least(greatest(coalesce(page_size, 1000), 1), 1000);
$$;

-- 00018 の ALTER DEFAULT PRIVILEGES により、新しい関数には anon / authenticated にも
-- EXECUTE が付く。invoker なので RLS が守ってはいるが、この関数は cron / admin の
-- バッチ専用で、ユーザー向け API から呼ぶ用途が無い。多層防御として実行権限も
-- service role だけに絞る。
revoke all on function public.list_entry_author_ids(uuid, int) from public, anon, authenticated;
grant execute on function public.list_entry_author_ids(uuid, int) to service_role;
