CREATE TABLE "products" (
	"sku" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_sku_format" CHECK ("products"."sku" ~ '^[A-Z0-9-]{3,20}$'),
	CONSTRAINT "products_name_not_blank" CHECK (btrim("products"."name") <> '')
);
--> statement-breakpoint
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_updated_by_profiles_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Existing labels with a SKU get their product first, named from the label
-- (same rule as productNameFor in entities/label-import.ts): drop the SKU
-- and pack-level words. Per SKU the shortest name wins, preferring labels
-- still in use. Editors can rename products in the app.
WITH named AS (
	SELECT
		l.sku,
		l.archived_at,
		coalesce(
			nullif(btrim(left(btrim(regexp_replace(regexp_replace(regexp_replace(
				l.name,
				'\m' || l.sku || '\M', ' ', 'gi'),
				'\m(SRP|SHIPPER|PALLET|CASE|LABELS?)\M', ' ', 'gi'),
				'\s+', ' ', 'g'), ' -'), 60)), ''),
			'Product ' || l.sku
		) AS name
	FROM "labels" l
	WHERE l.sku IS NOT NULL
)
INSERT INTO "products" ("sku", "name")
SELECT DISTINCT ON (sku) sku, name
FROM named
ORDER BY sku, (archived_at IS NOT NULL), length(name), name;
--> statement-breakpoint
ALTER TABLE "labels" ADD CONSTRAINT "labels_sku_products_sku_fk" FOREIGN KEY ("sku") REFERENCES "public"."products"("sku") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "labels_sku_idx" ON "labels" USING btree ("sku");--> statement-breakpoint
CREATE POLICY "products_select" ON "products" AS PERMISSIVE FOR SELECT TO "authenticated" USING (private.has_role('admin', 'editor', 'operator'));--> statement-breakpoint
CREATE POLICY "products_insert" ON "products" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (private.has_role('admin', 'editor') and "products"."created_by" = (select auth.uid()) and "products"."updated_by" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "products_update" ON "products" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (private.has_role('admin', 'editor')) WITH CHECK (private.has_role('admin', 'editor') and "products"."updated_by" = (select auth.uid()));--> statement-breakpoint
-- Keep API roles' grants minimal, as for labels (0004); the policies decide
-- which rows. A product's SKU and who created it never change.
REVOKE ALL ON TABLE public.products FROM anon, authenticated;
--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE public.products TO authenticated;
--> statement-breakpoint
GRANT UPDATE (name, updated_by, updated_at) ON TABLE public.products TO authenticated;
