-- Already applied to Supabase project vjlquacngircyabfijdi.
-- Kept here as deployment documentation / reproducibility.
ALTER TABLE public.topsid_hairstyles ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;
UPDATE public.topsid_hairstyles SET is_featured = (is_active = true AND collection_order BETWEEN 1 AND 15);
CREATE INDEX IF NOT EXISTS idx_topsid_hairstyles_featured_order ON public.topsid_hairstyles (collection_order, id) WHERE is_active = true AND is_featured = true;
