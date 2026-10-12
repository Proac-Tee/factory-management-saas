import { z } from "zod";
import { getImage } from "@/data-access/images";
import { getClaims } from "@/lib/auth";
import { findMember } from "@/data-access/members";

// A picture on a label, for signed-in members. The hash names the bytes
// exactly, so the browser can keep it for good.

const hashSchema = z.string().regex(/^[0-9a-f]{64}$/);

export async function GET(_request: Request, ctx: RouteContext<"/label-images/[hash]">) {
	const hash = hashSchema.safeParse((await ctx.params).hash);
	if (!hash.success) return new Response("Not found", { status: 404 });
	const claims = await getClaims();
	if (!claims || !(await findMember(claims))) return new Response("Sign in first", { status: 401 });
	const image = await getImage(claims, hash.data);
	if (!image) return new Response("Not found", { status: 404 });
	return new Response(Buffer.from(image.bytes), {
		headers: {
			"Content-Type": image.contentType,
			"Cache-Control": "private, max-age=31536000, immutable",
			"Content-Security-Policy": "default-src 'none'; sandbox",
		},
	});
}
