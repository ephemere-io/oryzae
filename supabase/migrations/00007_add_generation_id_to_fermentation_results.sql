-- Add Vercel AI Gateway generation_id for per-request cost tracking
ALTER TABLE fermentation_results
  ADD COLUMN generation_id text;

CREATE INDEX idx_fermentation_results_generation_id
  ON fermentation_results(generation_id)
  WHERE generation_id IS NOT NULL;
