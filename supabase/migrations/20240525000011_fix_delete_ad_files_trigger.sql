-- Drop the existing trigger first
DROP TRIGGER IF EXISTS delete_ad_files_trigger ON public.ads;

-- Drop the existing function
DROP FUNCTION IF EXISTS public.delete_ad_files();

-- Create the updated function with proper null checks
CREATE OR REPLACE FUNCTION public.delete_ad_files()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  storage_object RECORD;
  url_path TEXT;
BEGIN
  -- Delete original images
  IF OLD.original_image_urls IS NOT NULL AND array_length(OLD.original_image_urls, 1) > 0 THEN
    FOR i IN 1..array_length(OLD.original_image_urls, 1) LOOP
      IF OLD.original_image_urls[i] IS NOT NULL THEN
        url_path := (regexp_match(OLD.original_image_urls[i], 'public/([^?]+)'))[1];
        IF url_path IS NOT NULL THEN
          PERFORM storage.delete_object(url_path);
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
          PERFORM storage.delete_object(url_path);
        END IF;
      END IF;
    END LOOP;
  END IF;

  RETURN OLD;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER delete_ad_files_trigger
BEFORE DELETE ON public.ads
FOR EACH ROW
EXECUTE FUNCTION public.delete_ad_files(); 