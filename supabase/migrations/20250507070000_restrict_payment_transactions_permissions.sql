REVOKE INSERT ON TABLE public.payment_transactions FROM anon;
REVOKE UPDATE ON TABLE public.payment_transactions FROM anon;

REVOKE INSERT ON TABLE public.payment_transactions FROM authenticated;
REVOKE UPDATE ON TABLE public.payment_transactions FROM authenticated; 