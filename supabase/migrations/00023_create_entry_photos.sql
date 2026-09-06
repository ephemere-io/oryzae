-- Entry photos — 日記本文に添える写真の保管先。
--
-- 専用テーブルは作らず、Storage バケットと RLS だけを用意する。パスは
-- entries.media_urls (text[]) に保存する（URL ではなくストレージパス。理由は下記）。
--
-- **board-photos (00006) の初期設定をコピーしないこと。** あれは #504 で
-- (1) public バケット (2) read ポリシーにユーザー隔離が無い、の 2 点が重なって
-- 他人の写真を列挙・取得できる状態になっており、00021 で塞がれている。
-- 日記の写真は board よりさらに機微なので、最初から private + 隔離で作る。
insert into storage.buckets (id, name, public)
  values ('entry-photos', 'entry-photos', false)
  on conflict (id) do update set public = false;

-- パスの先頭セグメントを user_id にすることで、3 つのポリシーすべてが
-- auth.uid() で自分のフォルダだけに絞れる。
create policy "entry_photos_upload" on storage.objects
  for insert with check (
    bucket_id = 'entry-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- read にもユーザー隔離を入れる（#504 で board が漏れていたのはここ）。
create policy "entry_photos_read" on storage.objects
  for select using (
    bucket_id = 'entry-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "entry_photos_delete" on storage.objects
  for delete using (
    bucket_id = 'entry-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- private バケットなので公開 URL は存在しない。クライアントへ渡す URL は
-- サーバ側で createSignedUrl して都度発行する（board と同じ作法）。
-- 署名付き URL は失効するため、media_urls に保存するのは **ストレージパス**。
