import { z } from "zod";

const publicEnvSchema = z.object({
	NEXT_PUBLIC_SUPABASE_URL: z.url({ error: "NEXT_PUBLIC_SUPABASE_URL must be your Supabase project URL." }),
	NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
		.string({ error: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing." })
		.min(1, { error: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing." }),
});

// NEXT_PUBLIC_* vars must be referenced literally so Next.js can inline them
// into the browser bundle, so they're listed one by one, not as process.env.
const parsed = publicEnvSchema.safeParse({
	NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
	NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
});
if (!parsed.success) {
	throw new Error(`${z.prettifyError(parsed.error)}\n(see .env.example)`);
}

export const supabaseUrl = parsed.data.NEXT_PUBLIC_SUPABASE_URL;
export const supabasePublishableKey = parsed.data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
