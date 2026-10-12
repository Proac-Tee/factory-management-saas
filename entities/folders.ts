// The label library's folders, as on the Label Designs drive (AMAZON →
// AMAZON EU → SRP LABELS…). The rules for names and for building the tree
// live here; the database keeps names unique within a folder and stops a
// folder going inside itself.

import { z } from "zod";

export const FOLDER_NAME_MAX = 80;

/** A folder's name: trimmed, not blank, no slashes (they separate folders in a path). */
export const folderNameSchema = z
	.string()
	.trim()
	.min(1, { error: "Give the folder a name." })
	.max(FOLDER_NAME_MAX, { error: `Keep the name under ${FOLDER_NAME_MAX} characters.` })
	.refine((name) => !/[/\\]/.test(name), { error: "A folder name can't have a slash in it." });

/** A path of folder names from the top, e.g. ["AMAZON", "AMAZON EU", "SRP LABELS"]. */
export const folderPathSchema = z.array(folderNameSchema).max(12, { error: "Folders go up to 12 deep." });

export type FolderRow = { id: string; name: string; parentId: string | null; labelCount: number };

export type FolderNode = {
	id: string;
	name: string;
	parentId: string | null;
	/** Labels directly in this folder. */
	labelCount: number;
	/** Labels in this folder and every folder inside it. */
	totalCount: number;
	children: FolderNode[];
};

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "en-GB", { numeric: true, sensitivity: "base" });

/** The folders as a tree, each level by name, with label counts that include sub-folders. */
export const buildTree = (rows: FolderRow[]): FolderNode[] => {
	const nodes = new Map<string, FolderNode>(rows.map((r) => [r.id, { ...r, totalCount: r.labelCount, children: [] }]));
	const roots: FolderNode[] = [];
	for (const node of nodes.values()) {
		const parent = node.parentId ? nodes.get(node.parentId) : undefined;
		(parent ? parent.children : roots).push(node);
	}
	const finish = (list: FolderNode[]): number => {
		list.sort(byName);
		let total = 0;
		for (const node of list) {
			node.totalCount = node.labelCount + finish(node.children);
			total += node.totalCount;
		}
		return total;
	};
	finish(roots);
	return roots;
};

/** The folders from the top down to `id` (empty for the top level or an unknown id). */
export const pathTo = (rows: Pick<FolderRow, "id" | "name" | "parentId">[], id: string | null): { id: string; name: string }[] => {
	const byId = new Map(rows.map((r) => [r.id, r]));
	const path: { id: string; name: string }[] = [];
	const seen = new Set<string>();
	for (let at = id ? byId.get(id) : undefined; at && !seen.has(at.id); at = at.parentId ? byId.get(at.parentId) : undefined) {
		seen.add(at.id);
		path.unshift({ id: at.id, name: at.name });
	}
	return path;
};

/** `id` and every folder inside it, so a folder can't be moved into one of them. */
export const withDescendants = (rows: Pick<FolderRow, "id" | "parentId">[], id: string): Set<string> => {
	const inside = new Set([id]);
	let grew = true;
	while (grew) {
		grew = false;
		for (const r of rows) {
			if (r.parentId && inside.has(r.parentId) && !inside.has(r.id)) {
				inside.add(r.id);
				grew = true;
			}
		}
	}
	return inside;
};

/** Every folder with its full path name ("AMAZON / AMAZON EU"), for pickers, in tree order. */
export const folderOptions = (tree: FolderNode[], prefix = ""): { id: string; label: string; depth: number }[] =>
	tree.flatMap((node) => {
		const label = prefix ? `${prefix} / ${node.name}` : node.name;
		return [{ id: node.id, label, depth: prefix ? prefix.split(" / ").length : 0 }, ...folderOptions(node.children, label)];
	});
