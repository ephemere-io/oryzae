-- 手紙の既読をサーバに残す。
--
-- これまで既読は client の localStorage 止まりだった（use-unread-letters.ts）。そのため
-- ヘルプの五歩 ⑤「手紙を読む」の旗 (users/me の hasReadLetter) は「完了した発酵が
-- 1 通でもあるか」で代用しており、届いたまま未読でも true に倒れていた。
-- read_at を持たせ、POST /api/v1/fermentations/read が書き、hasReadLetter はこれを読む。
-- NULL = 未読。既存行は NULL のまま（過去の既読は復元しない。次に開いたときに埋まる）。
--
-- RLS は変えない。00003 の "Users can manage own fermentation results" (FOR ALL,
-- user_id = auth.uid()) が自分の行の update をそのまま許す。
ALTER TABLE fermentation_results
  ADD COLUMN read_at timestamptz;

COMMENT ON COLUMN fermentation_results.read_at IS
  '手紙を開いた時刻。NULL は未読。POST /api/v1/fermentations/read が書く';
