-- Migration: Add ai_dialect column to tenants table
-- Supports tenant-specific AI response style/dialect configuration.

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS ai_dialect text DEFAULT 'Egyptian';

COMMENT ON COLUMN public.tenants.ai_dialect IS
  'Tenant-specific AI response dialect/style preference.';
