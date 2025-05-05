-- Remove visual_style column from ads table
ALTER TABLE public.ads
DROP COLUMN IF EXISTS visual_style; 