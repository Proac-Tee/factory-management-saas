import "server-only";
import { z } from "zod";
import {
	createFolder as createFolderRow,
	deleteFolder as deleteFolderRow,
	type FolderChange,
	moveLabel as moveLabelRow,
	updateFolder,
} from "@/data-access/folders";
import { folderNameSchema } from "@/entities/folders";
import { idSchema } from "@/entities/validation";
import { requireMember } from "@/lib/auth";

// Arranging the library: folders and which folder a label is in. Editors and
// admins only; the database policies agree.

export type FolderResult = { ok: true; id: string; message: string } | { ok: false; message: string };

const REASONS: Record<Extract<FolderChange, { ok: false }>["reason"], string> = {
	taken: "There's already a folder with that name here. Pick another name.",
	"not-empty": "Only an empty folder can be deleted. Move its labels and folders out first, archived labels too.",
	"inside-itself": "A folder can't go inside itself or one of its own folders.",
	"not-found": "That folder isn't there any more. Refresh the page.",
};

const BROKEN = "That didn't work. Refresh the page and try again.";

const done = (result: FolderChange, message: string): FolderResult =>
	result.ok ? { ok: true, id: result.id, message } : { ok: false, message: REASONS[result.reason] };

const firstMessage = (error: z.ZodError) => error.issues[0]?.message ?? BROKEN;

const createSchema = z.object({ name: folderNameSchema, parentId: idSchema.nullable() });

export const createFolder = async (input: unknown): Promise<FolderResult> => {
	const member = await requireMember("edit-labels");
	const parsed = createSchema.safeParse(input);
	if (!parsed.success) return { ok: false, message: firstMessage(parsed.error) };
	const { name, parentId } = parsed.data;
	return done(await createFolderRow(member.claims, name, parentId), `Folder “${name}” made`);
};

const renameSchema = z.object({ id: idSchema, name: folderNameSchema });

export const renameFolder = async (input: unknown): Promise<FolderResult> => {
	const member = await requireMember("edit-labels");
	const parsed = renameSchema.safeParse(input);
	if (!parsed.success) return { ok: false, message: firstMessage(parsed.error) };
	return done(await updateFolder(member.claims, parsed.data.id, { name: parsed.data.name }), `Renamed to “${parsed.data.name}”`);
};

const moveSchema = z.object({ id: idSchema, parentId: idSchema.nullable() });

export const moveFolder = async (input: unknown): Promise<FolderResult> => {
	const member = await requireMember("edit-labels");
	const parsed = moveSchema.safeParse(input);
	if (!parsed.success) return { ok: false, message: BROKEN };
	if (parsed.data.id === parsed.data.parentId) return { ok: false, message: REASONS["inside-itself"] };
	return done(await updateFolder(member.claims, parsed.data.id, { parentId: parsed.data.parentId }), "Folder moved");
};

export const deleteFolder = async (input: unknown): Promise<FolderResult> => {
	const member = await requireMember("edit-labels");
	const id = idSchema.safeParse(input);
	if (!id.success) return { ok: false, message: BROKEN };
	return done(await deleteFolderRow(member.claims, id.data), "Folder deleted");
};

const moveLabelSchema = z.object({ labelId: idSchema, folderId: idSchema.nullable() });

export const moveLabelToFolder = async (input: unknown): Promise<FolderResult> => {
	const member = await requireMember("edit-labels");
	const parsed = moveLabelSchema.safeParse(input);
	if (!parsed.success) return { ok: false, message: BROKEN };
	const result = await moveLabelRow(member.claims, parsed.data.labelId, parsed.data.folderId);
	if (!result.ok && result.reason === "not-empty") return { ok: false, message: REASONS["not-found"] };
	return done(result, "Label moved");
};
