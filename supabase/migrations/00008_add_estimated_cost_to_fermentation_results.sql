-- Add estimated cost column for per-request cost tracking
ALTER TABLE fermentation_results
  ADD COLUMN estimated_cost_usd numeric(10, 6);
