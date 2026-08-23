-- board_cards の論理削除フラグを migrations に取り込む。
--
-- サーバーは以前からこの列を使っている
-- （supabase-board-card.repository.ts: .eq('is_deleted', false) / .update({ is_deleted: true })）
-- が、`supabase/migrations/` に定義が無く、本番にだけ存在する状態だった。
-- そのため使い捨てインスタンスでは以下で落ちる:
--
--   code: 42703  message: 'column board_cards.is_deleted does not exist'
--
-- 本番の実際の型・既定値に合わせる（boolean NOT NULL DEFAULT false）。
-- IF NOT EXISTS なので、既に列がある本番へ適用しても影響はない。

ALTER TABLE public.board_cards
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;

-- 論理削除されていないカードだけを引く問い合わせが主経路なので、部分インデックスを張る。
CREATE INDEX IF NOT EXISTS idx_board_cards_active
  ON public.board_cards (user_id, date_key, view_type)
  WHERE is_deleted = false;
