CREATE TABLE "folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"parent_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "folders_name_not_blank" CHECK (btrim("folders"."name") <> ''),
	CONSTRAINT "folders_name_length" CHECK (char_length("folders"."name") <= 80),
	CONSTRAINT "folders_not_own_parent" CHECK ("folders"."parent_id" is null or "folders"."parent_id" <> "folders"."id")
);
--> statement-breakpoint
ALTER TABLE "folders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "label_images" (
	"hash" text PRIMARY KEY NOT NULL,
	"content_type" text NOT NULL,
	"bytes" "bytea" NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "label_images_hash_format" CHECK ("label_images"."hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "label_images_type" CHECK ("label_images"."content_type" in ('image/png', 'image/jpeg', 'image/gif', 'image/webp')),
	CONSTRAINT "label_images_size" CHECK (octet_length("label_images"."bytes") between 1 and 5242880),
	CONSTRAINT "label_images_hash_matches" CHECK ("label_images"."hash" = encode(sha256("label_images"."bytes"), 'hex'))
);
--> statement-breakpoint
ALTER TABLE "label_images" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "labels" ADD COLUMN "folder_id" uuid;--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_parent_id_folders_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."folders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "label_images" ADD CONSTRAINT "label_images_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "folders_name_in_parent" ON "folders" USING btree (coalesce("parent_id", '00000000-0000-0000-0000-000000000000'::uuid),lower("name"));--> statement-breakpoint
ALTER TABLE "labels" ADD CONSTRAINT "labels_folder_id_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."folders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "labels_folder_idx" ON "labels" USING btree ("folder_id");--> statement-breakpoint
CREATE POLICY "folders_select" ON "folders" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select private.has_role('admin', 'editor', 'operator')));--> statement-breakpoint
CREATE POLICY "folders_insert" ON "folders" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select private.has_role('admin', 'editor')) and "folders"."created_by" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "folders_update" ON "folders" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select private.has_role('admin', 'editor'))) WITH CHECK ((select private.has_role('admin', 'editor')));--> statement-breakpoint
CREATE POLICY "folders_delete" ON "folders" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((select private.has_role('admin', 'editor')));--> statement-breakpoint
CREATE POLICY "label_images_select" ON "label_images" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select private.has_role('admin', 'editor', 'operator')));--> statement-breakpoint
CREATE POLICY "label_images_insert" ON "label_images" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select private.has_role('admin', 'editor')) and "label_images"."created_by" = (select auth.uid()));--> statement-breakpoint
-- A folder can't end up inside itself (moving LENHAMS into LENHAMS/SRP).
CREATE FUNCTION private.folders_no_cycle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
	cursor_id uuid := NEW.parent_id;
	depth int := 0;
BEGIN
	WHILE cursor_id IS NOT NULL LOOP
		IF cursor_id = NEW.id THEN
			RAISE EXCEPTION 'A folder can''t go inside itself.' USING errcode = 'check_violation';
		END IF;
		depth := depth + 1;
		IF depth > 50 THEN
			RAISE EXCEPTION 'Folders are nested too deep.' USING errcode = 'check_violation';
		END IF;
		SELECT f.parent_id INTO cursor_id FROM public.folders f WHERE f.id = cursor_id;
	END LOOP;
	RETURN NEW;
END;
$$;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION private.folders_no_cycle() FROM public, anon;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION private.folders_no_cycle() TO authenticated;
--> statement-breakpoint
CREATE TRIGGER folders_no_cycle BEFORE INSERT OR UPDATE OF parent_id ON public.folders
	FOR EACH ROW EXECUTE FUNCTION private.folders_no_cycle();
--> statement-breakpoint
-- Keep API roles' grants minimal, as for labels (0004); the policies decide which rows.
REVOKE ALL ON TABLE public.folders, public.label_images FROM anon, authenticated;
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON TABLE public.folders TO authenticated;
--> statement-breakpoint
GRANT UPDATE (name, parent_id) ON TABLE public.folders TO authenticated;
--> statement-breakpoint
-- Pictures are written once and never changed.
GRANT SELECT, INSERT ON TABLE public.label_images TO authenticated;
--> statement-breakpoint
GRANT UPDATE (folder_id) ON TABLE public.labels TO authenticated;
