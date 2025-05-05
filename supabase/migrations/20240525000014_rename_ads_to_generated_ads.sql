-- Rename ads table to generated_ads
ALTER TABLE public.ads RENAME TO generated_ads;

-- Update the delete_ad_files trigger function
CREATE OR REPLACE FUNCTION public.delete_ad_files()
RETURNS TRIGGER AS $$
DECLARE
  url_path text;
BEGIN
  -- Delete original images
  IF OLD.original_image_urls IS NOT NULL AND array_length(OLD.original_image_urls, 1) > 0 THEN
    FOR i IN 1..array_length(OLD.original_image_urls, 1) LOOP
      IF OLD.original_image_urls[i] IS NOT NULL THEN
        url_path := (regexp_match(OLD.original_image_urls[i], 'public/([^?]+)'))[1];
        IF url_path IS NOT NULL THEN
          PERFORM storage.delete_object('images', url_path);
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- Delete result images
  IF OLD.result_urls IS NOT NULL AND array_length(OLD.result_urls, 1) > 0 THEN
    FOR i IN 1..array_length(OLD.result_urls, 1) LOOP
      IF OLD.result_urls[i] IS NOT NULL THEN
        url_path := (regexp_match(OLD.result_urls[i], 'public/([^?]+)'))[1];
        IF url_path IS NOT NULL THEN
          PERFORM storage.delete_object('images', url_path);
        END IF;
      END IF;
    END LOOP;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate the trigger with the new table name
DROP TRIGGER IF EXISTS delete_ad_files_trigger ON public.generated_ads;
CREATE TRIGGER delete_ad_files_trigger
  BEFORE DELETE ON public.generated_ads
  FOR EACH ROW
  EXECUTE FUNCTION public.delete_ad_files();

-- Update RLS policies
DROP POLICY IF EXISTS "Users can view their own ads" ON public.generated_ads;
DROP POLICY IF EXISTS "Users can create ads" ON public.generated_ads;
DROP POLICY IF EXISTS "Users can update their own ads" ON public.generated_ads;
DROP POLICY IF EXISTS "Users can delete their own ads" ON public.generated_ads;

CREATE POLICY "Users can view their own generated_ads"
  ON public.generated_ads
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create generated_ads"
  ON public.generated_ads
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own generated_ads"
  ON public.generated_ads
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own generated_ads"
  ON public.generated_ads
  FOR DELETE
  USING (auth.uid() = user_id); 