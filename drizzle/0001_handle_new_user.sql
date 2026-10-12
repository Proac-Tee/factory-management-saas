-- Create a profile row whenever Supabase Auth creates a user.
-- SECURITY DEFINER is required because the insert runs as the auth admin
-- role. It lives in a non-exposed schema so it can't be called via the API.
CREATE SCHEMA IF NOT EXISTS private;
--> statement-breakpoint
REVOKE ALL ON SCHEMA private FROM public, anon, authenticated;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION private.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
	INSERT INTO public.profiles (id, email, full_name)
	VALUES (
		new.id,
		new.email,
		new.raw_user_meta_data ->> 'full_name'
	);
	RETURN new;
END;
$$;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION private.handle_new_user() FROM public, anon, authenticated;
--> statement-breakpoint
CREATE TRIGGER on_auth_user_created
	AFTER INSERT ON auth.users
	FOR EACH ROW EXECUTE FUNCTION private.handle_new_user();
--> statement-breakpoint
-- Only the policies above decide row access; keep API roles' grants minimal.
REVOKE ALL ON TABLE public.profiles FROM anon, authenticated;
--> statement-breakpoint
GRANT SELECT, UPDATE (full_name, updated_at) ON TABLE public.profiles TO authenticated;
