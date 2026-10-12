import "server-only";
import type { JwtPayload } from "@supabase/supabase-js";
import { and, count, eq, isNull, sql } from "drizzle-orm";
import type { FolderRow } from "@/entities/folders";
import { withRls, type Tx } from "@/lib/db/rls";
import { folders, labels } from "@/lib/db/schema";

// Folders run as the signed-in person (withRls): the policies in
// lib/db/schema.ts decide who may change them, and the database keeps names
// unique within a folder and stops a folder going inside itself.

/** Every folder, with how many labels in use sit directly in it. */
export const listFolders = (claims: JwtPayload) =>
	withRls(claims, async (tx): Promise<FolderRow[]> =>
		tx
			.select({ id: folders.id, name: folders.name, parentId: folders.parentId, labelCount: count(labels.id) })
			.from(folders)
			.leftJoin(labels, and(eq(labels.folderId, folders.id), isNull(labels.archivedAt)))
			.groupBy(folders.id),
	);

/** Postgres error codes the folder changes can hit. */
const UNIQUE = "23505";
const FOREIGN_KEY = "23503";
/** The no-cycle trigger and the not-own-parent check (names are checked before saving). */
const CHECK = "23514";

export type FolderChange = { ok: true; id: string } | { ok: false; reason: "taken" | "not-empty" | "inside-itself" | "not-found" };

const codeOf = (error: unknown): string | undefined => {
	const e = error as { code?: string; cause?: { code?: string } };
	return e.cause?.code ?? e.code;
};

/** Runs a change, turning the database's refusals into reasons. */
const change = async (run: () => Promise<string | null>): Promise<FolderChange> => {
	try {
		const id = await run();
		return id ? { ok: true, id } : { ok: false, reason: "not-found" };
	} catch (error) {
		const code = codeOf(error);
		if (code === UNIQUE) return { ok: false, reason: "taken" };
		if (code === FOREIGN_KEY) return { ok: false, reason: "not-empty" };
		if (code === CHECK) return { ok: false, reason: "inside-itself" };
		throw error;
	}
};

export const createFolder = (claims: JwtPayload, name: string, parentId: string | null) =>
	change(() =>
		withRls(claims, async (tx) => {
			const [row] = await tx.insert(folders).values({ name, parentId, createdBy: claims.sub }).returning({ id: folders.id });
			return row.id;
		}),
	);

export const updateFolder = (claims: JwtPayload, id: string, set: { name?: string; parentId?: string | null }) =>
	change(() =>
		withRls(claims, async (tx) => {
			const [row] = await tx.update(folders).set(set).where(eq(folders.id, id)).returning({ id: folders.id });
			return row?.id ?? null;
		}),
	);

/** Deletes an empty folder. Archived labels count: they still belong somewhere. */
export const deleteFolder = (claims: JwtPayload, id: string) =>
	change(() =>
		withRls(claims, async (tx) => {
			const [row] = await tx.delete(folders).where(eq(folders.id, id)).returning({ id: folders.id });
			return row?.id ?? null;
		}),
	);

/** Puts a label in a folder (null: the top level). */
export const moveLabel = (claims: JwtPayload, labelId: string, folderId: string | null) =>
	change(() =>
		withRls(claims, async (tx) => {
			const [row] = await tx
				.update(labels)
				.set({ folderId, updatedBy: claims.sub, updatedAt: sql`now()` })
				.where(eq(labels.id, labelId))
				.returning({ id: labels.id });
			return row?.id ?? null;
		}),
	);

/**
 * The folder at `path` under `parentId`, made where missing; null for an
 * empty path. Names match whatever their capitals, as the database does.
 */
export const ensureFolderPath = async (tx: Tx, createdBy: string, parentId: string | null, path: string[]): Promise<string | null> => {
	let at = parentId;
	for (const name of path) {
		await tx
			.insert(folders)
			.values({ name, parentId: at, createdBy })
			.onConflictDoNothing();
		const [row] = await tx
			.select({ id: folders.id })
			.from(folders)
			.where(and(at ? eq(folders.parentId, at) : isNull(folders.parentId), sql`lower(${folders.name}) = lower(${name})`));
		at = row.id;
	}
	return at;
};
