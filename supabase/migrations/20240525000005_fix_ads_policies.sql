-- Drop conflicting policies
DROP POLICY IF EXISTS "Users can create ads" ON public.ads;
DROP POLICY IF EXISTS "Users can update their own ads" ON public.ads;

-- Recreate the service role policies with higher priority
DROP POLICY IF EXISTS "Only service role can insert ads" ON public.ads;
DROP POLICY IF EXISTS "Only service role can update ads" ON public.ads;

CREATE POLICY "Only service role can insert ads" 
ON public.ads FOR INSERT 
WITH CHECK ((SELECT current_setting('request.jwt.claims', true)::json->>'role') = 'service_role');

CREATE POLICY "Only service role can update ads" 
ON public.ads FOR UPDATE 
USING ((SELECT current_setting('request.jwt.claims', true)::json->>'role') = 'service_role'); 