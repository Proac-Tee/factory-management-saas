import "server-only";
import type { JwtPayload } from "@supabase/supabase-js";
import { and, asc, count, desc, eq, ilike, isNull, ne, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { LabelDesign, LabelDetails, LabelKind } from "@/entities/label";
import { withRls } from "@/lib/db/rls";
import { labelChecks, labels, products, profiles } from "@/lib/db/schema";

// Every query here runs as the signed-in person (withRls), so the policies in
// lib/db/schema.ts decide what they can see and change.

export type LabelSummary = {
	id: string;
	name: string;
	customer: string;
	kind: LabelKind;
	sku: string | null;
	productName: string | null;
	storage: "ambient" | "chilled" | null;
	barcode: string | null;
	design: LabelDesign;
	updatedAt: string;
};

const summary = {
	id: labels.id,
	name: labels.name,
	customer: labels.customer,
	kind: labels.kind,
	sku: labels.sku,
	productName: products.name,
	storage: labels.storage,
	barcode: labels.barcode,
	design: labels.design,
	updatedAt: labels.updatedAt,
};

const toSummary = (row: { updatedAt: Date } & Omit<LabelSummary, "updatedAt">): LabelSummary => ({
	...row,
	updatedAt: row.updatedAt.toISOString(),
});

/** Labels in use, optionally narrowed by a search over name, customer, product, SKU and barcode. */
export const listLabels = (claims: JwtPayload, { query, kind }: { query?: string; kind?: LabelKind } = {}) =>
	withRls(claims, async (tx) => {
		const q = query?.trim();
		const rows = await tx
			.select(summary)
			.from(labels)
			.leftJoin(products, eq(products.sku, labels.sku))
			.where(
				and(
					isNull(labels.archivedAt),
					kind ? eq(labels.kind, kind) : undefined,
					q
						? or(
								ilike(labels.name, `%${q}%`),
								ilike(labels.sku, `%${q}%`),
								ilike(labels.customer, `%${q}%`),
								ilike(products.name, `%${q}%`),
								eq(labels.barcode, q.replace(/\s+/g, "")),
							)
						: undefined,
				),
			)
			.orderBy(asc(labels.customer), asc(labels.name));
		return rows.map(toSummary);
	});

const editor = alias(profiles, "editor");

export type LabelFull = LabelSummary & { updatedByName: string | null; archived: boolean };

export const getLabel = (claims: JwtPayload, id: string) =>
	withRls(claims, async (tx): Promise<LabelFull | null> => {
		const [row] = await tx
			.select({ ...summary, updatedByName: editor.fullName, archivedAt: labels.archivedAt })
			.from(labels)
			.leftJoin(products, eq(products.sku, labels.sku))
			.leftJoin(editor, eq(editor.id, labels.updatedBy))
			.where(eq(labels.id, id));
		if (!row) return null;
		const { archivedAt, updatedByName, ...rest } = row;
		return { ...toSummary(rest), updatedByName, archived: archivedAt !== null };
	});

export const listCustomers = (claims: JwtPayload) =>
	withRls(claims, async (tx) => {
		const rows = await tx
			.selectDistinct({ customer: labels.customer })
			.from(labels)
			.where(isNull(labels.archivedAt))
			.orderBy(asc(labels.customer));
		return rows.map((r) => r.customer);
	});

export type ProductOption = { sku: string; name: string; labelCount: number };

/** Every product, with how many labels in use carry it (for the editor). */
export const listProducts = (claims: JwtPayload) =>
	withRls(claims, async (tx): Promise<ProductOption[]> =>
		tx
			.select({ sku: products.sku, name: products.name, labelCount: count(labels.id) })
			.from(products)
			.leftJoin(labels, and(eq(labels.sku, products.sku), isNull(labels.archivedAt)))
			.groupBy(products.sku)
			.orderBy(asc(products.name)),
	);

/**
 * Creates or updates a label, and its product in the same transaction: a new
 * SKU adds the product, a changed name renames it for all its labels.
 * Returns the label's id, or null if the label to update wasn't found.
 */
export const saveLabel = (
	claims: JwtPayload,
	id: string | null,
	{ productName, ...details }: LabelDetails,
	design: LabelDesign,
) =>
	withRls(claims, async (tx): Promise<string | null> => {
		if (details.sku && productName) {
			await tx
				.insert(products)
				.values({ sku: details.sku, name: productName, createdBy: claims.sub, updatedBy: claims.sub })
				.onConflictDoUpdate({
					target: products.sku,
					set: { name: productName, updatedBy: claims.sub, updatedAt: sql`now()` },
					setWhere: ne(products.name, productName),
				});
		}
		if (id === null) {
			const [row] = await tx
				.insert(labels)
				.values({ ...details, design, createdBy: claims.sub, updatedBy: claims.sub })
				.returning({ id: labels.id });
			return row.id;
		}
		const [row] = await tx
			.update(labels)
			.set({ ...details, design, updatedBy: claims.sub, updatedAt: sql`now()` })
			.where(eq(labels.id, id))
			.returning({ id: labels.id });
		return row?.id ?? null;
	});

/** Takes a label out of the library, or puts it back. */
export const setLabelArchived = (claims: JwtPayload, id: string, archived: boolean) =>
	withRls(claims, async (tx) => {
		const rows = await tx
			.update(labels)
			.set({ archivedAt: archived ? sql`now()` : null, updatedBy: claims.sub, updatedAt: sql`now()` })
			.where(eq(labels.id, id))
			.returning({ id: labels.id });
		return rows.length > 0;
	});

/**
 * Labels for a scanned barcode: the exact number first, then labels for the
 * same item at another pack level (a pouch EAN-13 finds its case ITF-14).
 */
export const findByBarcode = (claims: JwtPayload, gtin: string) =>
	withRls(claims, async (tx) => {
		const item = gtin.length === 14 ? gtin.slice(1, 13) : gtin.slice(0, 12);
		const itemOf = sql`case when length(${labels.barcode}) = 14 then substr(${labels.barcode}, 2, 12) else left(${labels.barcode}, 12) end`;
		const rows = await tx
			.select(summary)
			.from(labels)
			.leftJoin(products, eq(products.sku, labels.sku))
			.where(and(isNull(labels.archivedAt), or(eq(labels.barcode, gtin), sql`${itemOf} = ${item}`)))
			.orderBy(desc(sql`${labels.barcode} = ${gtin}`), asc(labels.customer), asc(labels.name));
		return rows.map(toSummary);
	});

export const recordCheck = (claims: JwtPayload, labelId: string, expected: string, scanned: string) =>
	withRls(claims, async (tx) => {
		const [row] = await tx
			.insert(labelChecks)
			.values({ labelId, expected, scanned, result: expected === scanned ? "pass" : "fail", checkedBy: claims.sub })
			.returning({ id: labelChecks.id, checkedAt: labelChecks.checkedAt, result: labelChecks.result });
		return { ...row, checkedAt: row.checkedAt.toISOString() };
	});

export const lastChecks = (claims: JwtPayload, labelId: string) =>
	withRls(claims, async (tx) => {
		const checker = alias(profiles, "checker");
		const rows = await tx
			.select({
				id: labelChecks.id,
				result: labelChecks.result,
				scanned: labelChecks.scanned,
				checkedAt: labelChecks.checkedAt,
				checkedBy: checker.fullName,
			})
			.from(labelChecks)
			.leftJoin(checker, eq(checker.id, labelChecks.checkedBy))
			.where(eq(labelChecks.labelId, labelId))
			.orderBy(desc(labelChecks.checkedAt))
			.limit(5);
		return rows.map((r) => ({ ...r, checkedAt: r.checkedAt.toISOString() }));
	});
