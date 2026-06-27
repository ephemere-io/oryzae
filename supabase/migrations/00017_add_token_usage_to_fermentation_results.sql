-- Persist LLM token usage so cost can be computed from Claude pricing.
--
-- issue #352 で Vercel AI Gateway → Anthropic API 直叩きに切替えた結果、
-- generation_id が発行されなくなり generation_id ベースのコスト追跡が機能しなく
-- なった。トークン数を保存して価格表から cost を算出する方式に切り替える。
-- 既存行は NULL（過去分はトークン未保存のため cost 復元不可。今後の発酵から計上）。
ALTER TABLE fermentation_results
  ADD COLUMN input_tokens integer,
  ADD COLUMN output_tokens integer;
