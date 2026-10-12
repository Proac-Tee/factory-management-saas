import "server-only";
import { z } from "zod";
import {
	findByBarcode,
	getLabel,
	type LabelFull,
	type LabelSummary,
	listCustomers,
	listLabels,
	listProducts,
	type ProductOption,
	recordCheck,
	saveLabel as saveLabelRow,
	setLabelArchived,
} from "@/data-access/labels";
import { listFolders } from "@/data-access/folders";
import { buildTree, type FolderNode, folderOptions, type FolderRow, pathTo, withDescendants } from "@/entities/folders";
import { BARCODE_KIND_NAMES, checkGtin } from "@/entities/gtin";
import {
	checkDetails,
	type DetailsField,
	type FieldKey,
	fieldsUsed,
	KIND_NAMES,
	type LabelDesign,
	newDesign,
	parseDesign,
} from "@/entities/label";
import {
	type CustomerGroup,
	type FlatGroup,
	groupByCustomer,
	groupFlat,
	type LibraryQuery,
	libraryQuerySchema,
} from "@/entities/library";
import { can } from "@/entities/roles";
import { idSchema } from "@/entities/validation";
import { getMember, requireMember } from "@/lib/auth";

// The label studio's use cases. Each one checks the person may do it, parses
// its input (server actions are public endpoints, so input is unknown until
// Zod has read it), applies the entity rules, then reads or saves through
// data-access as that person, so the database policies agree.

export type { LabelFull, LabelSummary, ProductOption };

// ─── Reading ─────────────────────────────────────────────────────────────────

export type FolderView = {
	group: "folder";
	tree: FolderNode[];
	/** The open folder's path from the top; empty at the top level. */
	path: { id: string; name: string }[];
	/** Folders inside the open one. */
	folders: FolderNode[];
	/** Labels directly in the open folder (at the top level: labels in no folder). */
	labels: LabelSummary[];
	/** When searching: every match, grouped by the folder it's in. */
	results: FlatGroup<LabelSummary>[] | null;
};

export type Library =
	| FolderView
	| { group: "customer"; customers: CustomerGroup<LabelSummary>[] }
	| { group: "kind" | "size"; groups: FlatGroup<LabelSummary>[] };

export type LibraryView = {
	query: LibraryQuery;
	library: Library;
	total: number;
	customerCount: number;
	canEdit: boolean;
};

/** The library for the search, grouping and filter in the URL. */
export const getLibrary = async (searchParams: unknown): Promise<LibraryView> => {
	const member = await getMember();
	const query = libraryQuerySchema.parse(searchParams);
	const [labels, folderRows] = await Promise.all([
		listLabels(member.claims, { query: query.q, kind: query.kind }),
		query.group === "folder" ? listFolders(member.claims) : [],
	]);
	return {
		query,
		library:
			query.group === "folder"
				? folderView(labels, folderRows, query)
				: query.group === "customer"
					? { group: "customer", customers: groupByCustomer(labels) }
					: { group: query.group, groups: groupFlat(labels, query.group) },
		total: labels.length,
		customerCount: new Set(labels.map((l) => l.customer)).size,
		canEdit: can(member.role, "edit-labels"),
	};
};

const NO_FOLDER = "Not in a folder";

const folderView = (labels: LabelSummary[], rows: FolderRow[], query: LibraryQuery): FolderView => {
	const tree = buildTree(rows);
	const path = pathTo(rows, query.folder ?? null);
	const openId = path.at(-1)?.id ?? null;
	const find = (nodes: FolderNode[]): FolderNode | undefined =>
		nodes.reduce<FolderNode | undefined>((found, n) => found ?? (n.id === openId ? n : find(n.children)), undefined);
	const searching = query.q !== "" || query.kind !== undefined;
	let results: FlatGroup<LabelSummary>[] | null = null;
	if (searching) {
		// Every match, under its folder's full path, folders in tree order.
		const nameOf = (id: string | null) => (id ? pathTo(rows, id).map((f) => f.name).join(" / ") || NO_FOLDER : NO_FOLDER);
		const groups = new Map<string, LabelSummary[]>();
		for (const label of labels) groups.set(nameOf(label.folderId), [...(groups.get(nameOf(label.folderId)) ?? []), label]);
		results = [...groups.entries()]
			.sort(([a], [b]) => Number(a === NO_FOLDER) - Number(b === NO_FOLDER) || a.localeCompare(b, "en-GB", { numeric: true }))
			.map(([name, items]) => ({ name, labels: items.toSorted((a, b) => a.name.localeCompare(b.name, "en-GB", { numeric: true })) }));
	}
	return {
		group: "folder",
		tree,
		path,
		folders: openId ? (find(tree)?.children ?? []) : tree,
		labels: searching ? [] : labels.filter((l) => l.folderId === openId),
		results,
	};
};

export type EditorView = {
	label: LabelFull | null;
	design: LabelDesign;
	customers: string[];
	products: ProductOption[];
	/** Every folder by its path, for moving the label. */
	folders: { id: string; label: string }[];
	canEdit: boolean;
};

/** A label with what its editor needs, or null when there's no such label. */
export const getLabelEditor = async (rawId: unknown): Promise<EditorView | null> => {
	const member = await requireMember("use-labels");
	const id = idSchema.safeParse(rawId);
	if (!id.success) return null;
	const [label, customers, products, folderRows] = await Promise.all([
		getLabel(member.claims, id.data),
		listCustomers(member.claims),
		listProducts(member.claims),
		listFolders(member.claims),
	]);
	if (!label) return null;
	const folders = folderOptions(buildTree(folderRows)).map(({ id, label }) => ({ id, label }));
	return { label, design: readDesign(label), customers, products, folders, canEdit: can(member.role, "edit-labels") };
};

/** A blank editor for a new label (editors and admins only). */
export const getNewLabelEditor = async (): Promise<EditorView> => {
	const member = await requireMember("edit-labels");
	const [customers, products] = await Promise.all([listCustomers(member.claims), listProducts(member.claims)]);
	return { label: null, design: newDesign(), customers, products, folders: [], canEdit: true };
};

export type PrintView = { label: LabelFull; design: LabelDesign; fields: FieldKey[] };

export const getLabelToPrint = async (rawId: unknown): Promise<PrintView | null> => {
	const member = await requireMember("use-labels");
	const id = idSchema.safeParse(rawId);
	if (!id.success) return null;
	const label = await getLabel(member.claims, id.data);
	if (!label) return null;
	const design = readDesign(label);
	return { label, design, fields: fieldsUsed(design) };
};

const scanQuerySchema = z.object({
	mode: z.enum(["find", "check"]).catch("find"),
	label: idSchema.optional().catch(undefined),
});

export type ScanView = {
	mode: "find" | "check";
	label: { id: string; name: string; barcode: string | null } | null;
};

/** The scan screen: find labels by barcode, or check a printed label. */
export const getScan = async (searchParams: unknown): Promise<ScanView> => {
	const member = await requireMember("use-labels");
	const { mode, label: labelId } = scanQuerySchema.parse(searchParams);
	const label = mode === "check" && labelId ? await getLabel(member.claims, labelId) : null;
	return { mode, label: label && { id: label.id, name: label.name, barcode: label.barcode } };
};

/** A stored design that no longer parses is a bug to fix, not something to draw. */
const readDesign = (label: LabelFull): LabelDesign => {
	const design = parseDesign(label.design);
	if (!design.ok) throw new Error(`Label ${label.id} has a broken layout: ${design.message}`);
	return design.design;
};

// ─── Changing ────────────────────────────────────────────────────────────────

const NOT_FOUND = "That label wasn't found. Go back to the library.";

export type SaveResult = { ok: true; id: string } | { ok: false; field?: DetailsField | "design"; message: string };

const saveInputSchema = z.object({
	id: idSchema.nullable(),
	details: z.unknown(),
	design: z.unknown(),
});

export const saveLabel = async (input: unknown): Promise<SaveResult> => {
	const member = await requireMember("edit-labels");
	const parsed = saveInputSchema.safeParse(input);
	if (!parsed.success) return { ok: false, message: NOT_FOUND };
	const details = checkDetails(parsed.data.details);
	if (!details.ok) return details;
	const design = parseDesign(parsed.data.design);
	if (!design.ok) return { ok: false, field: "design", message: design.message };

	const id = await saveLabelRow(member.claims, parsed.data.id, details.details, design.design);
	return id ? { ok: true, id } : { ok: false, message: NOT_FOUND };
};

const archiveInputSchema = z.object({ id: idSchema, archived: z.boolean() });

export const setArchived = async (input: unknown): Promise<{ ok: boolean; id?: string }> => {
	const member = await requireMember("edit-labels");
	const parsed = archiveInputSchema.safeParse(input);
	if (!parsed.success) return { ok: false };
	const ok = await setLabelArchived(member.claims, parsed.data.id, parsed.data.archived);
	return { ok, id: parsed.data.id };
};

// ─── Scanning ────────────────────────────────────────────────────────────────

export type FoundLabel = { id: string; name: string; detail: string; exact: boolean };
export type FindResult =
	| { ok: true; gtin: string; kindName: string; labels: FoundLabel[] }
	| { ok: false; message: string };

/** Labels carrying a scanned or typed barcode, exact matches first. */
export const findLabels = async (input: unknown): Promise<FindResult> => {
	const member = await requireMember("use-labels");
	const gtin = checkGtin(z.string().max(64).catch("").parse(input));
	if (!gtin.ok) return { ok: false, message: gtin.message };
	const labels = await findByBarcode(member.claims, gtin.gtin);
	return {
		ok: true,
		gtin: gtin.gtin,
		kindName: BARCODE_KIND_NAMES[gtin.kind],
		labels: labels.map((l) => ({
			id: l.id,
			name: l.name,
			detail: `${l.customer}, ${KIND_NAMES[l.kind]}${l.barcode === gtin.gtin ? "" : `, ${l.barcode?.length === 14 ? "case" : "pouch"} barcode`}`,
			exact: l.barcode === gtin.gtin,
		})),
	};
};

export type CheckResult =
	| { ok: true; result: "pass" | "fail"; expected: string; scanned: string; checkedAt: string; checkedBy: string }
	| { ok: false; message: string };

const checkInputSchema = z.object({
	labelId: idSchema,
	scanned: z
		.string()
		.transform((s) => s.replace(/\s+/g, ""))
		.pipe(z.string().regex(/^\d{8,14}$/, { error: "That wasn't a product barcode. Scan the long barcode on the label." })),
});

/** Compares a scanned printed label with the barcode the label should carry. */
export const checkPrintedLabel = async (input: unknown): Promise<CheckResult> => {
	const member = await requireMember("use-labels");
	const parsed = checkInputSchema.safeParse(input);
	if (!parsed.success) {
		const [issue] = parsed.error.issues;
		return { ok: false, message: issue.path[0] === "labelId" ? "Pick the label you printed first." : issue.message };
	}
	const { labelId, scanned } = parsed.data;
	const label = await getLabel(member.claims, labelId);
	if (!label) return { ok: false, message: "That label wasn't found." };
	if (!label.barcode) return { ok: false, message: "This label has no barcode number yet, so there's nothing to check against." };

	const valid = checkGtin(scanned);
	// A misread or wrong barcode is still recorded as a failed check.
	const saved = await recordCheck(member.claims, labelId, label.barcode, valid.ok ? valid.gtin : scanned);
	return {
		ok: true,
		result: saved.result,
		expected: label.barcode,
		scanned,
		checkedAt: saved.checkedAt,
		checkedBy: member.name,
	};
};

// ─── Downloading ─────────────────────────────────────────────────────────────

export type DownloadLabel = { name: string; folderPath: string[]; design: LabelDesign; barcode: string | null };
export type FolderDownload = { ok: true; zipName: string; labels: DownloadLabel[] } | { ok: false; message: string };

/**
 * Every label in a folder and the folders inside it, each with its path from
 * that folder, for a zip. No folder: the whole library.
 */
export const getFolderDownload = async (input: unknown): Promise<FolderDownload> => {
	const member = await requireMember("use-labels");
	const folderId = idSchema.nullable().safeParse(input);
	if (!folderId.success) return { ok: false, message: "That folder wasn't found. Refresh the page." };
	const [labels, rows] = await Promise.all([listLabels(member.claims), listFolders(member.claims)]);
	const top = folderId.data;
	if (top && !rows.some((r) => r.id === top)) return { ok: false, message: "That folder isn't there any more. Refresh the page." };
	const inside = top ? withDescendants(rows, top) : null;
	const depth = top ? pathTo(rows, top).length : 0;
	const chosen = labels
		.filter((l) => (inside ? l.folderId !== null && inside.has(l.folderId) : true))
		.map((l) => ({
			name: l.name,
			folderPath: pathTo(rows, l.folderId).slice(depth).map((f) => f.name),
			design: readDesign({ ...l, updatedByName: null, archived: false }),
			barcode: l.barcode,
		}))
		.sort((a, b) => [...a.folderPath, a.name].join("/").localeCompare([...b.folderPath, b.name].join("/"), "en-GB", { numeric: true }));
	const zipName = top ? (rows.find((r) => r.id === top)?.name ?? "Labels") : "Labels";
	return { ok: true, zipName, labels: chosen };
};
