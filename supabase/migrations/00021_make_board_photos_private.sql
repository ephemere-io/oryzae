-- board-photos を非公開化し、読み取りにユーザー隔離を入れる（Issue #504）
--
-- 何が起きていたか:
--   00006 のコメントは「users can upload/read/delete their own photos」と書いてあるが、
--   実際には 2 つの穴があった。
--
--   1) バケットが public = true で作られていた
--      public バケットのオブジェクトは /storage/v1/object/public/... から
--      **認証なしで**取得できる。storage.objects の RLS ポリシーは
--      この公開経路には適用されない。URL を知っていれば誰でも閲覧できた。
--
--   2) 読み取りポリシーにユーザー隔離が無かった
--        for select using (bucket_id = 'board-photos')
--      upload / delete は auth.uid() で正しく絞れているのに read だけ抜けていた。
--      認証 API 経由でも他ユーザーのオブジェクトを取得できた。
--
--   1) だけ、あるいは 2) だけを直しても塞がらない。両方必要。
--
-- ⚠ 適用順序に注意:
--   このマイグレーションを適用すると公開 URL が無効になる。
--   署名付き URL を発行するアプリ側の変更（SupabaseBoardStorageGateway.getImageUrl）を
--   **先にデプロイしてから** このマイグレーションを適用すること。
--   逆順にすると、デプロイが終わるまでボードの写真が表示されなくなる。
--   （署名付き URL は公開バケットでも機能するため、この順序なら断絶が起きない）

-- 1) 非公開化
update storage.buckets set public = false where id = 'board-photos';

-- 2) 読み取りを所有者だけに絞る。
--    パスの先頭セグメントが uploader の user_id（00006 の upload ポリシーと同じ規約）。
drop policy if exists "board_photos_read" on storage.objects;

create policy "board_photos_read" on storage.objects
  for select using (
    bucket_id = 'board-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
