-- 005_batch_business_fields.sql
-- Add monthly fee and description to batches table non-destructively

ALTER TABLE batches ADD COLUMN IF NOT EXISTS monthly_fee NUMERIC(12,2) NOT NULL DEFAULT 0.00;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS description TEXT NULL;
