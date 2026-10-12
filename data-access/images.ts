import "server-only";
import type { JwtPayload } from "@supabase/supabase-js";
import { eq, inArray } from "drizzle-orm";
import { withRls } from "@/lib/db/rls";
import { labelImages } from "@/lib/db/schema";

// Pictures on labels, stored once by their SHA-256. The database checks the
// hash matches the bytes, so a stored hash always names the same picture.

export const getImage = (claims: JwtPayload, hash: string) =>
	withRls(claims, async (tx) => {
		const [row] = await tx
			.select({ contentType: labelImages.contentType, bytes: labelImages.bytes })
			.from(labelImages)
			.where(eq(labelImages.hash, hash));
		return row ?? null;
	});

/** Which of these pictures are stored already. */
export const storedImages = (claims: JwtPayload, hashes: string[]) =>
	withRls(claims, async (tx) => {
		if (hashes.length === 0) return new Set<string>();
		const rows = await tx.select({ hash: labelImages.hash }).from(labelImages).where(inArray(labelImages.hash, hashes));
		return new Set(rows.map((r) => r.hash));
	});

/** Stores a picture; one already there is left as it is. */
export const saveImage = (claims: JwtPayload, hash: string, contentType: string, bytes: Uint8Array) =>
	withRls(claims, async (tx) => {
		await tx.insert(labelImages).values({ hash, contentType, bytes, createdBy: claims.sub }).onConflictDoNothing();
	});
