-- Drop existing policies
DROP POLICY IF EXISTS "Users can insert their own credits" ON public.credits;

-- Create policy for users to insert their own credits
CREATE POLICY "Users can insert their own credits" 
ON public.credits FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Allow service_role to insert into credits table (e.g., for initial credit allocation by triggers)
CREATE POLICY "Service role can insert credits"
ON public.credits FOR INSERT
TO service_role -- Or specify the role that owns the SECURITY DEFINER function
WITH CHECK (true); -- service_role can insert any valid record

-- Function to ensure user has credits
CREATE OR REPLACE FUNCTION public.ensure_user_credits()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if user already has credits
  IF NOT EXISTS (
    SELECT 1 FROM public.credits WHERE user_id = NEW.id
  ) THEN
    -- Insert initial credits if none exist
    INSERT INTO public.credits (user_id, amount)
    VALUES (NEW.id, 6);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create new trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.ensure_user_credits();

-- Function to get or create user credits
CREATE OR REPLACE FUNCTION public.get_or_create_user_credits()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_id UUID;
  credit_amount INTEGER;
BEGIN
  -- Get user_id from token
  user_id := auth.uid();
  
  IF user_id IS NULL THEN
    RAISE EXCEPTION 'No user ID found in token';
  END IF;

  -- Try to get existing credits
  SELECT amount INTO credit_amount
  FROM public.credits
  WHERE user_id = get_or_create_user_credits.user_id;

  -- If no credits exist, create them
  IF credit_amount IS NULL THEN
    INSERT INTO public.credits (user_id, amount)
    VALUES (user_id, 6)
    RETURNING amount INTO credit_amount;
  END IF;

  RETURN credit_amount;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_or_create_user_credits() TO authenticated; 