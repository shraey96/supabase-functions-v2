-- Update credit configurations
UPDATE public.credit_configs
SET 
  base_cost = 2,
  additional_params = '{"medium_image": 2, "high_image": 3, "extra_sample": 1, "premium_style": 2}'::JSONB,
  description = 'Credit cost for ad generation with quality-based pricing',
  updated_at = now()
WHERE operation = 'generate_ad';

-- If no record exists, insert one
INSERT INTO public.credit_configs 
  (operation, base_cost, additional_params, description)
SELECT 
  'generate_ad',
  2,
  '{"medium_image": 2, "high_image": 3, "extra_sample": 1, "premium_style": 2}'::JSONB,
  'Credit cost for ad generation with quality-based pricing'
WHERE NOT EXISTS (
  SELECT 1 FROM public.credit_configs WHERE operation = 'generate_ad'
); 