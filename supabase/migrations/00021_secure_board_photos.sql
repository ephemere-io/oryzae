-- #504: board-photos は (1) public バケット、(2) read ポリシーにユーザー隔離が無い、
-- の 2 点が重なっており、他ユーザーの写真を列挙・取得できる状態だった。
-- upload / delete は auth.uid() で正しく絞れているので read だけが実装漏れ。

-- 1. read ポリシーにユーザー隔離を追加する
drop policy if exists "board_photos_read" on storage.objects;
create policy "board_photos_read" on storage.objects
  for select using (
    bucket_id = 'board-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- 2. バケットを private 化する（署名なし URL での取得を塞ぐ）。
--    クライアントへ渡す URL はサーバ側で createSignedUrl に切り替え済み。
update storage.buckets set public = false where id = 'board-photos';
