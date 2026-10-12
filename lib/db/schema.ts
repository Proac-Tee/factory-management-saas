import { sql } from "drizzle-orm";
import {
	check,
	index,
	jsonb,
	pgEnum,
	pgPolicy,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { authenticatedRole, authUid, authUsers } from "drizzle-orm/supabase";
import { LABEL_KINDS, type LabelDesign, STORAGE_TYPES } from "../../entities/label";
import { ROLES } from "../../entities/roles";

// Role checks for policies. private.has_role() reads the signed-in person's
// role from the allowed list (drizzle/0002_app_role_function.sql).
const hasRole = (...roles: string[]) =>
	sql.raw(`private.has_role(${roles.map((r) => `'${r}'`).join(", ")})`);
const anyRole = hasRole(...ROLES);

// One row per Supabase Auth user, created by the on_auth_user_created
// trigger (see drizzle/0001_*.sql).
export const profiles = pgTable(
	"profiles",
	{
		id: uuid()
			.primaryKey()
			.references(() => authUsers.id, { onDelete: "cascade" }),
		email: text().notNull(),
		fullName: text("full_name"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => sql`now()`),
	},
	(t) => [
		pgPolicy("profiles_select_own", {
			for: "select",
			to: authenticatedRole,
			using: sql`${t.id} = ${authUid}`,
		}),
		// Names appear on labels people edited and on the access screen.
		pgPolicy("profiles_select_team", {
			for: "select",
			to: authenticatedRole,
			using: anyRole,
		}),
		pgPolicy("profiles_update_own", {
			for: "update",
			to: authenticatedRole,
			using: sql`${t.id} = ${authUid}`,
			withCheck: sql`${t.id} = ${authUid}`,
		}),
	],
).enableRLS();

export type Profile = typeof profiles.$inferSelect;

// ─── Access ──────────────────────────────────────────────────────────────────

export const appRole = pgEnum("app_role", ROLES);

/**
 * Emails allowed to sign up, and the role each one gets. The only source of
 * a person's role: removing a row removes their access straight away.
 */
export const allowedEmails = pgTable(
	"allowed_emails",
	{
		email: text().primaryKey(),
		role: appRole().notNull().default("operator"),
		addedBy: uuid("added_by").references(() => profiles.id, { onDelete: "set null" }),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		check("allowed_emails_lowercase", sql`${t.email} = lower(btrim(${t.email}))`),
		check("allowed_emails_format", sql`${t.email} ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'`),
		// Everyone can see their own entry (it holds their role); admins see all.
		pgPolicy("allowed_emails_select", {
			for: "select",
			to: authenticatedRole,
			using: sql`${hasRole("admin")} or ${t.email} = lower((select auth.jwt() ->> 'email'))`,
		}),
		pgPolicy("allowed_emails_insert", {
			for: "insert",
			to: authenticatedRole,
			withCheck: sql`${hasRole("admin")} and ${t.addedBy} = ${authUid}`,
		}),
		pgPolicy("allowed_emails_update", {
			for: "update",
			to: authenticatedRole,
			using: hasRole("admin"),
			withCheck: hasRole("admin"),
		}),
		pgPolicy("allowed_emails_delete", {
			for: "delete",
			to: authenticatedRole,
			using: hasRole("admin"),
		}),
	],
).enableRLS();

// ─── Products ────────────────────────────────────────────────────────────────

const SKU_CHECK = "'^[A-Z0-9-]{3,20}$'";

/**
 * What Ember packs, by SKU. Labels for the same product (its SRP, shipper
 * and pallet labels) share a SKU, so the library groups them under one name
 * that editors can change in one place. Never deleted.
 */
export const products = pgTable(
	"products",
	{
		sku: text().primaryKey(),
		name: text().notNull(),
		createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
		updatedBy: uuid("updated_by").references(() => profiles.id, { onDelete: "set null" }),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => sql`now()`),
	},
	(t) => [
		check("products_sku_format", sql`${t.sku} ~ ${sql.raw(SKU_CHECK)}`),
		check("products_name_not_blank", sql`btrim(${t.name}) <> ''`),
		pgPolicy("products_select", {
			for: "select",
			to: authenticatedRole,
			using: anyRole,
		}),
		pgPolicy("products_insert", {
			for: "insert",
			to: authenticatedRole,
			withCheck: sql`${hasRole("admin", "editor")} and ${t.createdBy} = ${authUid} and ${t.updatedBy} = ${authUid}`,
		}),
		pgPolicy("products_update", {
			for: "update",
			to: authenticatedRole,
			using: hasRole("admin", "editor"),
			withCheck: sql`${hasRole("admin", "editor")} and ${t.updatedBy} = ${authUid}`,
		}),
	],
).enableRLS();

export type ProductRow = typeof products.$inferSelect;

// ─── Labels ──────────────────────────────────────────────────────────────────

export const labelKind = pgEnum("label_kind", LABEL_KINDS);
export const storageType = pgEnum("storage_type", STORAGE_TYPES);

/**
 * A label: who it's for, what kind it is, its barcode, and its design (size
 * and parts, checked by parseDesign in entities/label.ts). Never deleted:
 * archived labels drop out of the library but keep their history.
 */
export const labels = pgTable(
	"labels",
	{
		id: uuid().primaryKey().defaultRandom(),
		name: text().notNull(),
		customer: text().notNull(),
		kind: labelKind().notNull(),
		/** The product the label is for; none for hold, waste, address labels. */
		sku: text().references(() => products.sku, { onUpdate: "cascade" }),
		storage: storageType(),
		/** GTIN-13 (pouch, EAN-13) or GTIN-14 (case, ITF-14) */
		barcode: text(),
		design: jsonb().$type<LabelDesign>().notNull(),
		/** The LibreOffice file it was imported from, so imports can be rerun. */
		sourceFile: text("source_file").unique(),
		createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
		updatedBy: uuid("updated_by").references(() => profiles.id, { onDelete: "set null" }),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => sql`now()`),
		archivedAt: timestamp("archived_at", { withTimezone: true }),
	},
	(t) => [
		check("labels_name_not_blank", sql`btrim(${t.name}) <> ''`),
		check("labels_customer_not_blank", sql`btrim(${t.customer}) <> ''`),
		check("labels_sku_format", sql`${t.sku} is null or ${t.sku} ~ ${sql.raw(SKU_CHECK)}`),
		check("labels_barcode_format", sql`${t.barcode} is null or ${t.barcode} ~ '^[0-9]{13,14}$'`),
		check("labels_design_is_object", sql`jsonb_typeof(${t.design}) = 'object'`),
		index("labels_barcode_idx").on(t.barcode),
		index("labels_customer_idx").on(t.customer),
		index("labels_sku_idx").on(t.sku),
		pgPolicy("labels_select", {
			for: "select",
			to: authenticatedRole,
			using: anyRole,
		}),
		pgPolicy("labels_insert", {
			for: "insert",
			to: authenticatedRole,
			withCheck: sql`${hasRole("admin", "editor")} and ${t.createdBy} = ${authUid} and ${t.updatedBy} = ${authUid}`,
		}),
		pgPolicy("labels_update", {
			for: "update",
			to: authenticatedRole,
			using: hasRole("admin", "editor"),
			withCheck: sql`${hasRole("admin", "editor")} and ${t.updatedBy} = ${authUid}`,
		}),
	],
).enableRLS();

export type LabelRow = typeof labels.$inferSelect;

export const checkResult = pgEnum("check_result", ["pass", "fail"]);

/** A printed label scanned to check its barcode. Written once, never edited. */
export const labelChecks = pgTable(
	"label_checks",
	{
		id: uuid().primaryKey().defaultRandom(),
		labelId: uuid("label_id")
			.notNull()
			.references(() => labels.id),
		expected: text().notNull(),
		scanned: text().notNull(),
		result: checkResult().notNull(),
		checkedBy: uuid("checked_by")
			.notNull()
			.references(() => profiles.id),
		checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		check(
			"label_checks_result_matches",
			sql`(${t.result} = 'pass') = (${t.scanned} = ${t.expected})`,
		),
		index("label_checks_label_idx").on(t.labelId, t.checkedAt),
		pgPolicy("label_checks_select", {
			for: "select",
			to: authenticatedRole,
			using: anyRole,
		}),
		pgPolicy("label_checks_insert", {
			for: "insert",
			to: authenticatedRole,
			withCheck: sql`${anyRole} and ${t.checkedBy} = ${authUid}`,
		}),
	],
).enableRLS();
