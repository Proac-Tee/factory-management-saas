CREATE TYPE "public"."app_role" AS ENUM('admin', 'editor', 'operator');--> statement-breakpoint
CREATE TYPE "public"."check_result" AS ENUM('pass', 'fail');--> statement-breakpoint
CREATE TYPE "public"."label_kind" AS ENUM('srp', 'shipper', 'pallet', 'hold', 'waste', 'sample', 'address', 'barcode', 'other');--> statement-breakpoint
CREATE TYPE "public"."storage_type" AS ENUM('ambient', 'chilled');--> statement-breakpoint
CREATE TABLE "allowed_emails" (
	"email" text PRIMARY KEY NOT NULL,
	"role" "app_role" DEFAULT 'operator' NOT NULL,
	"added_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "allowed_emails_lowercase" CHECK ("allowed_emails"."email" = lower(btrim("allowed_emails"."email"))),
	CONSTRAINT "allowed_emails_format" CHECK ("allowed_emails"."email" ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$')
);
--> statement-breakpoint
ALTER TABLE "allowed_emails" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "label_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label_id" uuid NOT NULL,
	"expected" text NOT NULL,
	"scanned" text NOT NULL,
	"result" "check_result" NOT NULL,
	"checked_by" uuid NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "label_checks_result_matches" CHECK (("label_checks"."result" = 'pass') = ("label_checks"."scanned" = "label_checks"."expected"))
);
--> statement-breakpoint
ALTER TABLE "label_checks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "labels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"customer" text NOT NULL,
	"kind" "label_kind" NOT NULL,
	"sku" text,
	"storage" "storage_type",
	"barcode" text,
	"design" jsonb NOT NULL,
	"source_file" text,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "labels_source_file_unique" UNIQUE("source_file"),
	CONSTRAINT "labels_name_not_blank" CHECK (btrim("labels"."name") <> ''),
	CONSTRAINT "labels_customer_not_blank" CHECK (btrim("labels"."customer") <> ''),
	CONSTRAINT "labels_sku_format" CHECK ("labels"."sku" is null or "labels"."sku" ~ '^[A-Z0-9-]{3,20}$'),
	CONSTRAINT "labels_barcode_format" CHECK ("labels"."barcode" is null or "labels"."barcode" ~ '^[0-9]{13,14}$'),
	CONSTRAINT "labels_design_is_object" CHECK (jsonb_typeof("labels"."design") = 'object')
);
--> statement-breakpoint
ALTER TABLE "labels" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "allowed_emails" ADD CONSTRAINT "allowed_emails_added_by_profiles_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "label_checks" ADD CONSTRAINT "label_checks_label_id_labels_id_fk" FOREIGN KEY ("label_id") REFERENCES "public"."labels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "label_checks" ADD CONSTRAINT "label_checks_checked_by_profiles_id_fk" FOREIGN KEY ("checked_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labels" ADD CONSTRAINT "labels_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labels" ADD CONSTRAINT "labels_updated_by_profiles_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "label_checks_label_idx" ON "label_checks" USING btree ("label_id","checked_at");--> statement-breakpoint
CREATE INDEX "labels_barcode_idx" ON "labels" USING btree ("barcode");--> statement-breakpoint
CREATE INDEX "labels_customer_idx" ON "labels" USING btree ("customer");--> statement-breakpoint
CREATE POLICY "profiles_select_team" ON "profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING (private.has_role('admin', 'editor', 'operator'));--> statement-breakpoint
CREATE POLICY "allowed_emails_select" ON "allowed_emails" AS PERMISSIVE FOR SELECT TO "authenticated" USING (private.has_role('admin') or "allowed_emails"."email" = lower((select auth.jwt() ->> 'email')));--> statement-breakpoint
CREATE POLICY "allowed_emails_insert" ON "allowed_emails" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (private.has_role('admin') and "allowed_emails"."added_by" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "allowed_emails_update" ON "allowed_emails" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (private.has_role('admin')) WITH CHECK (private.has_role('admin'));--> statement-breakpoint
CREATE POLICY "allowed_emails_delete" ON "allowed_emails" AS PERMISSIVE FOR DELETE TO "authenticated" USING (private.has_role('admin'));--> statement-breakpoint
CREATE POLICY "label_checks_select" ON "label_checks" AS PERMISSIVE FOR SELECT TO "authenticated" USING (private.has_role('admin', 'editor', 'operator'));--> statement-breakpoint
CREATE POLICY "label_checks_insert" ON "label_checks" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (private.has_role('admin', 'editor', 'operator') and "label_checks"."checked_by" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "labels_select" ON "labels" AS PERMISSIVE FOR SELECT TO "authenticated" USING (private.has_role('admin', 'editor', 'operator'));--> statement-breakpoint
CREATE POLICY "labels_insert" ON "labels" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (private.has_role('admin', 'editor') and "labels"."created_by" = (select auth.uid()) and "labels"."updated_by" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "labels_update" ON "labels" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (private.has_role('admin', 'editor')) WITH CHECK (private.has_role('admin', 'editor') and "labels"."updated_by" = (select auth.uid()));