// How the label library is arranged. The default is the folders, as on the
// Label Designs drive. Customer puts each product's SRP, shipper and pallet
// labels side by side; type and size give flat views.

import { z } from "zod";
import { KIND_NAMES, LABEL_KINDS, type LabelKind } from "./label";

export const GROUPINGS = { folder: "Folders", customer: "Customer", kind: "Type", size: "Size" } as const;
export type Grouping = keyof typeof GROUPINGS;

/** The library's search, grouping and filter, read from the URL. Bad values fall back. */
export const libraryQuerySchema = z.object({
	q: z.string().trim().max(80).catch(""),
	group: z.enum(["folder", "customer", "kind", "size"]).catch("folder"),
	/** The folder open in the folder view; none is the top level. */
	folder: z.uuid().optional().catch(undefined),
	kind: z.enum(LABEL_KINDS).optional().catch(undefined),
	denied: z.string().optional().catch(undefined),
});
export type LibraryQuery = z.output<typeof libraryQuerySchema>;

/** The least a label needs to be placed in the library. */
export type Placeable = {
	customer: string;
	kind: LabelKind;
	name: string;
	sku: string | null;
	productName: string | null;
	design: { widthMm: number; heightMm: number };
};

export type ProductGroup<T> = { sku: string | null; name: string; labels: T[] };
export type CustomerGroup<T> = { name: string; count: number; products: ProductGroup<T>[] };
export type FlatGroup<T> = { name: string; labels: T[] };

/** Labels with no product (hold, waste, address…) sit here, after the products. */
export const GENERAL = "General";

const byName = (a: string, b: string) => a.localeCompare(b, "en-GB", { numeric: true, sensitivity: "base" });
const kindOrder = (kind: LabelKind) => LABEL_KINDS.indexOf(kind);

export const sizeName = (design: { widthMm: number; heightMm: number }) =>
	`${Math.round(design.widthMm)} × ${Math.round(design.heightMm)} mm`;

/** Customer → product → labels in kind order (SRP, shipper, pallet, …). */
export const groupByCustomer = <T extends Placeable>(labels: T[]): CustomerGroup<T>[] => {
	const customers = new Map<string, Map<string, ProductGroup<T>>>();
	for (const label of labels) {
		const products = customers.get(label.customer) ?? new Map<string, ProductGroup<T>>();
		customers.set(label.customer, products);
		const key = label.sku ?? "";
		const product = products.get(key) ?? {
			sku: label.sku,
			name: label.sku ? (label.productName ?? label.sku) : GENERAL,
			labels: [],
		};
		product.labels.push(label);
		products.set(key, product);
	}

	return [...customers.entries()]
		.sort(([a], [b]) => byName(a, b))
		.map(([name, products]) => {
			const sorted = [...products.values()]
				.map((p) => ({
					...p,
					labels: p.labels.toSorted((a, b) => kindOrder(a.kind) - kindOrder(b.kind) || byName(a.name, b.name)),
				}))
				// Products by name, General last.
				.sort((a, b) => Number(a.sku === null) - Number(b.sku === null) || byName(a.name, b.name));
			return { name, count: sorted.reduce((n, p) => n + p.labels.length, 0), products: sorted };
		});
};

/** One level of groups by kind or by size, labels by name. */
export const groupFlat = <T extends Placeable>(labels: T[], by: "kind" | "size"): FlatGroup<T>[] => {
	const groups = new Map<string, T[]>();
	for (const label of labels) {
		const key = by === "kind" ? KIND_NAMES[label.kind] : sizeName(label.design);
		groups.set(key, [...(groups.get(key) ?? []), label]);
	}
	return [...groups.entries()]
		.sort(([a], [b]) => byName(a, b))
		.map(([name, items]) => ({ name, labels: items.toSorted((a, b) => byName(a.name, b.name)) }));
};

/** The library's URL with some of its query changed; defaults are left out. */
export const libraryHref = (query: LibraryQuery, change: Partial<Pick<LibraryQuery, "q" | "group" | "kind" | "folder">>): string => {
	const next = { q: query.q, group: query.group, kind: query.kind, folder: query.folder, ...change };
	const params = new URLSearchParams();
	if (next.q) params.set("q", next.q);
	if (next.group !== "folder") params.set("group", next.group);
	if (next.group === "folder" && next.folder) params.set("folder", next.folder);
	if (next.kind) params.set("kind", next.kind);
	const search = params.toString();
	return search ? `/labels?${search}` : "/labels";
};
