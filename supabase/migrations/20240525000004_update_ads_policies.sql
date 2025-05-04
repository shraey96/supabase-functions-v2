-- Create policies for the ads table

-- Enable RLS on the ads table if not already enabled
ALTER TABLE IF EXISTS public.ads ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view their own ads" ON public.ads;
DROP POLICY IF EXISTS "Only service role can insert ads" ON public.ads;
DROP POLICY IF EXISTS "Only service role can update ads" ON public.ads;

-- Create policy for users to view their own ads
CREATE POLICY "Users can view their own ads" 
ON public.ads FOR SELECT 
USING (auth.uid() = user_id);

-- Create policy for service role to insert ads
CREATE POLICY "Only service role can insert ads" 
ON public.ads FOR INSERT 
WITH CHECK ((SELECT current_setting('request.jwt.claims', true)::json->>'role') = 'service_role');

-- Create policy for service role to update ads
CREATE POLICY "Only service role can update ads" 
ON public.ads FOR UPDATE 
USING ((SELECT current_setting('request.jwt.claims', true)::json->>'role') = 'service_role'); 