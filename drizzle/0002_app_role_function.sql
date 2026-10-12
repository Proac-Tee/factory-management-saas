-- Roles for the label studio. The allowed list (public.allowed_emails, next
-- migration) is the one source of truth: a person's role is the role on their
-- email's allowed-list entry, and taking the email off the list removes all
-- access at once, even for someone already signed in.
-- plpgsql, so the table and enum it reads can be created by the next
-- migration (generated from lib/db/schema.ts). Text, not the enum, for the
-- same reason.
-- SECURITY DEFINER: policies call it as the signed-in user, who can't read
-- auth.users or the whole allowed list themselves.
CREATE FUNCTION private.app_role()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
	RETURN (
		SELECT a.role::text
		FROM public.allowed_emails a
		JOIN auth.users u ON lower(u.email) = a.email
		WHERE u.id = (SELECT auth.uid())
	);
END;
$$;
--> statement-breakpoint
CREATE FUNCTION private.has_role(variadic roles text[])
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
	RETURN coalesce(private.app_role() = ANY (roles), false);
END;
$$;
--> statement-breakpoint
-- Policies run as "authenticated", so it needs the schema and these two only.
GRANT USAGE ON SCHEMA private TO authenticated;
--> statement-breakpoint
REVOKE ALL ON FUNCTION private.app_role(), private.has_role(text[]) FROM public, anon;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION private.app_role(), private.has_role(text[]) TO authenticated;
