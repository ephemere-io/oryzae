-- Add error_message column to store failure reasons for failed fermentations
ALTER TABLE fermentation_results
  ADD COLUMN error_message text;
