-- Create Credit Configurations Table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'credit_configs') THEN
    CREATE TABLE public.credit_configs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      operation TEXT NOT NULL,
      base_cost INTEGER NOT NULL DEFAULT 2,
      additional_params JSONB DEFAULT '{}'::JSONB,
      description TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
      
      -- Ensure unique operation types
      CONSTRAINT unique_operation UNIQUE (operation)
    );

    -- Set up row-level security policies
    ALTER TABLE public.credit_configs ENABLE ROW LEVEL SECURITY;

    -- Policy for selecting configs (anyone can view)
    CREATE POLICY "Anyone can view credit configs" 
    ON public.credit_configs FOR SELECT 
    USING (true);

    -- Policy for updating configs (only service role)
    CREATE POLICY "Only service role can update credit configs" 
    ON public.credit_configs FOR UPDATE 
    USING ((SELECT current_setting('request.jwt.claims', true)::json->>'role') = 'service_role');
  END IF;
END $$;

-- Insert or update default configurations
INSERT INTO public.credit_configs 
  (operation, base_cost, additional_params, description)
VALUES 
  ('generate_ad', 2, 
   '{"medium_image": 2, "high_image": 3, "extra_sample": 1, "premium_style": 2}'::JSONB, 
   'Credit cost for ad generation with quality-based pricing')
ON CONFLICT (operation) 
DO UPDATE SET 
  base_cost = EXCLUDED.base_cost,
  additional_params = EXCLUDED.additional_params,
  description = EXCLUDED.description,
  updated_at = now(); 