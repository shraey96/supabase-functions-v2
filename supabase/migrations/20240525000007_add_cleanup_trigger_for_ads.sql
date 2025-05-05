-- Function to clean up storage files when an ad is deleted
CREATE OR REPLACE FUNCTION public.delete_ad_files()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  storage_object RECORD;
BEGIN
  -- Delete original images
  IF OLD.original_image_urls IS NOT NULL AND array_length(OLD.original_image_urls, 1) > 0 THEN
    FOR i IN 1..array_length(OLD.original_image_urls, 1) LOOP
      -- Extract the path part from the URL
      -- Format: https://project.supabase.co/storage/v1/object/public/bucket-name/path/to/file.jpg
      -- We want: path/to/file.jpg
      IF OLD.original_image_urls[i] IS NOT NULL THEN
        PERFORM
          storage.delete_object(
            (regexp_match(OLD.original_image_urls[i], 'public/([^?]+)'))[1]
          );
      END IF;
    END LOOP;
  END IF;

  -- Delete result images
  IF OLD.result_urls IS NOT NULL AND array_length(OLD.result_urls, 1) > 0 THEN
    FOR i IN 1..array_length(OLD.result_urls, 1) LOOP
      IF OLD.result_urls[i] IS NOT NULL THEN
        PERFORM
          storage.delete_object(
            (regexp_match(OLD.result_urls[i], 'public/([^?]+)'))[1]
          );
      END IF;
    END LOOP;
  END IF;

  RETURN OLD;
END;
$$;

-- Create or replace the trigger
DROP TRIGGER IF EXISTS delete_ad_files_trigger ON public.ads;

CREATE TRIGGER delete_ad_files_trigger
BEFORE DELETE ON public.ads
FOR EACH ROW
EXECUTE FUNCTION public.delete_ad_files(); 