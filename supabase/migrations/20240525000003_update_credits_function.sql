-- Drop the old function
DROP FUNCTION IF EXISTS public.update_user_credits(integer, uuid, text, jsonb);

-- Create new function that gets user_id from token
CREATE OR REPLACE FUNCTION public.update_user_credits(
  amount_param integer,
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
  user_id_from_token UUID;
BEGIN
  -- Get user_id from token
  user_id_from_token := (SELECT auth.uid());
  
  IF user_id_from_token IS NULL THEN
    RAISE EXCEPTION 'No user ID found in token';
  END IF;

  -- Check if the caller is the service role
  is_service_role := (SELECT current_setting('request.jwt.claims', true)::json->>'role') = 'service_role';
  
  -- Only allow service role to call this function
  IF NOT is_service_role THEN
    RAISE EXCEPTION 'Only service role can update credits';
  END IF;

  -- Get current credit amount
  SELECT amount INTO current_amount
  FROM public.credits
  WHERE user_id = user_id_from_token
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
    user_id_from_token,
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
  WHERE user_id = user_id_from_token;

  RETURN TRUE;
END;
$$;

-- Grant permission only to service role
GRANT EXECUTE ON FUNCTION public.update_user_credits(integer, text, jsonb) TO service_role; 