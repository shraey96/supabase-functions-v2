-- Create Brands Table
CREATE TABLE public.brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  color_palette TEXT[],
  industry TEXT,
  website_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Set up row-level security policies
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

-- Policy for selecting brands
CREATE POLICY "Users can view their own brands" 
ON public.brands FOR SELECT USING (
  auth.uid() = user_id
);

-- Policy for inserting brands
CREATE POLICY "Users can create brands" 
ON public.brands FOR INSERT WITH CHECK (
  auth.uid() = user_id
);

-- Policy for updating brands
CREATE POLICY "Users can update their own brands" 
ON public.brands FOR UPDATE USING (
  auth.uid() = user_id
);

-- Policy for deleting brands
CREATE POLICY "Users can delete their own brands" 
ON public.brands FOR DELETE USING (
  auth.uid() = user_id
);

-- Create Ads Table
CREATE TABLE public.ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL, -- Optional brand association
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  visual_style TEXT,
  result_urls TEXT[] DEFAULT '{}',
  original_image_urls TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  error_message TEXT,
  ad_type TEXT DEFAULT 'standard',
  dimensions TEXT,
  metadata JSONB DEFAULT '{}'::JSONB, -- JSON object with parameters that affected credits
  credits_used INTEGER DEFAULT 2,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Set up row-level security policies
ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;

-- Policy for selecting ads
CREATE POLICY "Users can view their own ads" 
ON public.ads FOR SELECT USING (
  auth.uid() = user_id
);

-- Policy for inserting ads
CREATE POLICY "Users can create ads" 
ON public.ads FOR INSERT WITH CHECK (
  auth.uid() = user_id
);

-- Policy for updating ads (system or owner)
CREATE POLICY "Users can update their own ads" 
ON public.ads FOR UPDATE USING (
  auth.uid() = user_id
); 