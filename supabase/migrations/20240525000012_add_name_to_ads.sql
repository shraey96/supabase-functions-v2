-- Add name column to ads table
ALTER TABLE public.ads
ADD COLUMN name TEXT;

-- Update existing rows to have a default name based on prompt
UPDATE public.ads
SET name = COALESCE(
  CASE 
    WHEN LENGTH(prompt) > 50 THEN SUBSTRING(prompt, 1, 47) || '...'
    ELSE prompt
  END,
  'Untitled Ad'
)
WHERE name IS NULL;

-- Make name column required for future inserts
ALTER TABLE public.ads
ALTER COLUMN name SET NOT NULL,
ALTER COLUMN name SET DEFAULT 'Untitled Ad'; 