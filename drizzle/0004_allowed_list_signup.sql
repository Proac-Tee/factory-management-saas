-- Only emails on the allowed list can create an account. The app checks first
-- to show a clear message; this trigger is the guarantee, so a sign-up sent
-- straight to the Supabase API is refused too.
CREATE OR REPLACE FUNCTION private.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM public.allowed_emails WHERE email = lower(btrim(new.email))
	) THEN
		RAISE EXCEPTION 'This email is not on the allowed list.'
			USING errcode = 'insufficient_privilege';
	END IF;

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

-- Keep API roles' grants minimal; the policies decide which rows.
REVOKE ALL ON TABLE public.allowed_emails, public.labels, public.label_checks FROM anon, authenticated;
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON TABLE public.allowed_emails TO authenticated;
--> statement-breakpoint
GRANT UPDATE (role) ON TABLE public.allowed_emails TO authenticated;
--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE public.labels TO authenticated;
--> statement-breakpoint
-- Who created a label and where it was imported from never change.
GRANT UPDATE (name, customer, kind, sku, storage, barcode, design, updated_by, updated_at, archived_at)
	ON TABLE public.labels TO authenticated;
--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE public.label_checks TO authenticated;
