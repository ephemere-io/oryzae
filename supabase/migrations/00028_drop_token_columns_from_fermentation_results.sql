-- fermentation_results から「使った量」の列を消す。
--
-- 発酵のトークン数は 00027 で ai_usage に移し、コードも ai_usage に書く・読むようにした。
-- fermentation_results は発酵そのもの（どの問いで・どの期間を・成功したか）だけを持つ。
--
--   input_tokens / output_tokens: ai_usage に移した（00027 で件数と合計が一致することを確認済み）
--   generation_id: Vercel AI Gateway 時代の問い合わせ用 ID。Gateway もキーも撤去済みで引けない
--
-- CASCADE は付けない。この列に依存するものが残っていれば、消さずに失敗させる。
DROP INDEX IF EXISTS public.idx_fermentation_results_generation_id;

ALTER TABLE public.fermentation_results
  DROP COLUMN input_tokens,
  DROP COLUMN output_tokens,
  DROP COLUMN generation_id;
