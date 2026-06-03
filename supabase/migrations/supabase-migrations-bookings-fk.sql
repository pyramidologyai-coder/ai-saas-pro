-- Migration: Add Foreign Key Constraint from bookings(item_id) to items(id)
-- Safety: older databases may not have bookings.item_id yet, so this migration
-- only adds the constraint when both tables/columns exist and the constraint is
-- absent. If orphaned values exist, it fails with a clear message instead of
-- silently creating inconsistent referential integrity.

DO $$
DECLARE
  orphan_count integer;
BEGIN
  IF to_regclass('public.bookings') IS NULL OR to_regclass('public.items') IS NULL THEN
    RAISE NOTICE 'Skipping bookings_item_id_fkey: public.bookings or public.items does not exist.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bookings'
      AND column_name = 'item_id'
  ) THEN
    RAISE NOTICE 'Skipping bookings_item_id_fkey: public.bookings.item_id does not exist.';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bookings_item_id_fkey'
      AND conrelid = 'public.bookings'::regclass
  ) THEN
    RETURN;
  END IF;

  SELECT COUNT(*)
  INTO orphan_count
  FROM public.bookings b
  WHERE b.item_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.items i WHERE i.id = b.item_id);

  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'Cannot add bookings_item_id_fkey: % orphaned bookings.item_id values exist.', orphan_count;
  END IF;

  ALTER TABLE public.bookings
    ADD CONSTRAINT bookings_item_id_fkey
    FOREIGN KEY (item_id)
    REFERENCES public.items(id)
    ON DELETE SET NULL;
END;
$$;
