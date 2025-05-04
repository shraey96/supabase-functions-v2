-- Create Credits Table
CREATE TABLE public.credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  
  -- Ensure credits never go negative
  CONSTRAINT credits_non_negative CHECK (amount >= 0),
  -- Each user has only one credit record
  CONSTRAINT one_record_per_user UNIQUE (user_id)
);

-- Set up row-level security policies
ALTER TABLE public.credits ENABLE ROW LEVEL SECURITY;

-- Policy for selecting credits (users can only view their own)
CREATE POLICY "Users can view their own credits" 
ON public.credits FOR SELECT USING (
  auth.uid() = user_id
);

-- Policy for updating credits (only system via functions)
CREATE POLICY "Only system can update credits" 
ON public.credits FOR UPDATE USING (
  (SELECT current_setting('request.jwt.claims', true)::json->>'role') = 'service_role'
);

-- Create Credit Transactions Table for Audit Trail
CREATE TABLE public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL, -- Positive for additions, negative for deductions
  operation TEXT NOT NULL,
  operation_id UUID, -- Reference to the entity that used credits
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'refunded', 'failed')),
  metadata JSONB DEFAULT '{}'::JSONB, -- Additional details about the transaction
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Set up row-level security policies
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

-- Policy for selecting transactions (users can only view their own)
CREATE POLICY "Users can view their own transactions" 
ON public.credit_transactions FOR SELECT USING (
  auth.uid() = user_id
);

-- Policy for inserting transactions (only system via functions)
CREATE POLICY "Only system can insert transactions" 
ON public.credit_transactions FOR INSERT WITH CHECK (
  (SELECT current_setting('request.jwt.claims', true)::json->>'role') = 'service_role'
);

-- Policy for updating transactions (only system via functions)
CREATE POLICY "Only system can update transactions" 
ON public.credit_transactions FOR UPDATE USING (
  (SELECT current_setting('request.jwt.claims', true)::json->>'role') = 'service_role'
);

-- Create Credit Configurations Table
CREATE TABLE public.credit_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation TEXT NOT NULL,
  base_cost INTEGER NOT NULL DEFAULT 2,
  additional_params JSONB DEFAULT '{}'::JSONB, -- For configurable factors (quality, samples, etc.)
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  
  -- Ensure unique operation types
  CONSTRAINT unique_operation UNIQUE (operation)
);

-- Insert default configurations
INSERT INTO public.credit_configs 
  (operation, base_cost, additional_params, description)
VALUES 
  ('generate_ad', 2, 
   '{"high_quality": 1, "extra_sample": 1, "premium_style": 2}'::JSONB, 
   'Credit cost for ad generation');

-- Function to initialize credits for new users (6 credits)
CREATE OR REPLACE FUNCTION public.initialize_user_credits()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.credits (user_id, amount)
  VALUES (NEW.id, 6);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger the function every time a user is created
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.initialize_user_credits();

-- Drop the existing update_user_credits function if it exists
DROP FUNCTION IF EXISTS public.update_user_credits(integer, uuid);

-- Create a new secure function for updating credits
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