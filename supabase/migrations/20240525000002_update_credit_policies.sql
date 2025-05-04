-- Drop existing policies
DROP POLICY IF EXISTS "Only system can update credits" ON public.credits;
DROP POLICY IF EXISTS "Only system can insert transactions" ON public.credit_transactions;
DROP POLICY IF EXISTS "Only system can update transactions" ON public.credit_transactions;

-- Create new secure policies
CREATE POLICY "Only system can update credits" 
ON public.credits FOR UPDATE USING (
  (SELECT current_setting('request.jwt.claims', true)::json->>'role') = 'service_role'
);

CREATE POLICY "Only system can insert transactions" 
ON public.credit_transactions FOR INSERT WITH CHECK (
  (SELECT current_setting('request.jwt.claims', true)::json->>'role') = 'service_role'
);

CREATE POLICY "Only system can update transactions" 
ON public.credit_transactions FOR UPDATE USING (
  (SELECT current_setting('request.jwt.claims', true)::json->>'role') = 'service_role'
);

-- Drop and recreate the update_user_credits function with proper security
DROP FUNCTION IF EXISTS public.update_user_credits(integer, uuid);

CREATE OR REPLACE FUNCTION public.update_user_credits(
  amount_param integer,
  user_id_param uuid,
  operation_type text,
  metadata jsonb DEFAULT '{}'::jsonb
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_amount INTEGER;
  is_service_role BOOLEAN;
BEGIN
  -- Check if the caller is the service role
  is_service_role := (SELECT current_setting('request.jwt.claims', true)::json->>'role') = 'service_role';
  
  -- Only allow service role to call this function
  IF NOT is_service_role THEN
    RAISE EXCEPTION 'Only service role can update credits';
  END IF;

  -- Get current credit amount
  SELECT amount INTO current_amount
  FROM public.credits
  WHERE user_id = user_id_param
  FOR UPDATE; -- Lock the row for update

  -- Check if the update would result in negative credits
  IF current_amount + amount_param < 0 THEN
    RETURN FALSE;
  END IF;

  -- Create transaction record first
  INSERT INTO public.credit_transactions (
    user_id,
    amount,
    operation,
    status,
    metadata
  ) VALUES (
    user_id_param,
    amount_param,
    operation_type,
    'completed',
    metadata
  );

  -- Update the credits
  UPDATE public.credits
  SET 
    amount = current_amount + amount_param,
    updated_at = now()
  WHERE user_id = user_id_param;

  RETURN TRUE;
END;
$$;

-- Grant permission only to service role
GRANT EXECUTE ON FUNCTION public.update_user_credits(integer, uuid, text, jsonb) TO service_role; 