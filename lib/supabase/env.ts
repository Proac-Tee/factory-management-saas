const required = (name: string, value: string | undefined): string => {
	if (!value) {
		throw new Error(`Missing env var ${name} (see .env.example).`);
	}
	return value;
};

// NEXT_PUBLIC_* vars must be referenced literally so Next.js can inline them
// into the browser bundle.
export const supabaseUrl = required(
	"NEXT_PUBLIC_SUPABASE_URL",
	process.env.NEXT_PUBLIC_SUPABASE_URL,
);
export const supabasePublishableKey = required(
	"NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
	process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);
