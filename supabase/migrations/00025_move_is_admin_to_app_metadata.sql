-- 管理者フラグ is_admin を user_metadata から app_metadata へ移す。
--
-- admin-auth ミドルウェアはこれまで `user.user_metadata.is_admin` で管理者を判定していた。
-- しかし Supabase Auth の user_metadata（auth.users.raw_user_meta_data）は
-- **本人が `auth.updateUser({ data: {...} })` で自由に書き換えられる**領域で、
-- 公式ドキュメントも「認可には使わず app_metadata を使う」と明記している。
-- このままだと anon key を手にした一般ユーザーが自分に is_admin: true を付け、
-- /api/v1/admin/*（service role で RLS をバイパスする経路）に入れてしまう。
-- 今はブラウザに anon key を渡していないので叩けないが、Supabase 自身は anon key を
-- 公開してよい鍵と位置づけているため、その秘匿に頼らない形にする。
--
-- app_metadata（raw_app_meta_data）は service role の auth.admin.updateUserById か
-- SQL からしか書けない。ミドルウェア側は同じ PR で app_metadata を読むよう変えてある。
--
-- **この migration はミドルウェアの変更がデプロイされる前に適用すること。**
-- 逆順だと、適用までの間、既存の管理者が全員 403 で管理画面から締め出される
-- （データが壊れることはなく、適用すれば戻る）。
--
-- 冪等: 2 回流しても 2 回目は対象行が無いので何も起きない。
update auth.users
set
  raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"is_admin": true}'::jsonb,
  -- 移した後の user_metadata に残しておくと「本人が書き換えられる場所に認可フラグが
  -- ある」ように見えて誤解を招くので、ここで消す。判定には使っていないので消しても
  -- 管理者権限に影響は無い。
  raw_user_meta_data = raw_user_meta_data - 'is_admin'
where raw_user_meta_data @> '{"is_admin": true}'::jsonb;
