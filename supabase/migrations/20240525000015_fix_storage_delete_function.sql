-- Update the delete_ad_files trigger function with correct storage function
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
          PERFORM storage.objects.delete(url_path);
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
          PERFORM storage.objects.delete(url_path);
        END IF;
      END IF;
    END LOOP;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 