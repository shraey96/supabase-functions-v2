-- Drop any existing delete policy
DROP POLICY IF EXISTS "Users can delete their own ads" ON public.ads;
DROP POLICY IF EXISTS "Only service role can delete ads" ON public.ads;

-- Create policy for users to delete their own ads
CREATE POLICY "Users can delete their own ads" 
ON public.ads FOR DELETE 
USING (auth.uid() = user_id);

-- Create policy for service role to delete ads
CREATE POLICY "Only service role can delete ads" 
ON public.ads FOR DELETE 
USING ((SELECT current_setting('request.jwt.claims', true)::json->>'role') = 'service_role'); 