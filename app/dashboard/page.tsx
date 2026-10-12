import { eq } from "drizzle-orm";
import { Suspense } from "react";
import { logout } from "@/app/(auth)/actions";
import { getCurrentUser } from "@/lib/auth";
import { profiles } from "@/lib/db/schema";
import { withRls } from "@/lib/db/rls";

export default function Page() {
	return (
		<main className="flex flex-1 flex-col gap-6 p-6">
			<h1 className="text-2xl font-semibold">Dashboard</h1>
			{/* Reads the session, so it streams in at request time. */}
			<Suspense fallback={<p>Loading…</p>}>
				<Account />
			</Suspense>
		</main>
	);
}

async function Account() {
	const user = await getCurrentUser();
	const [profile] = await withRls(user.claims, (tx) =>
		tx.select().from(profiles).where(eq(profiles.id, user.id)),
	);

	return (
		<section className="flex flex-col gap-2">
			<p>
				Signed in as <strong>{profile?.fullName ?? user.email}</strong>
			</p>
			<form action={logout}>
				<button type="submit" className="rounded border px-3 py-2">
					Sign out
				</button>
			</form>
		</section>
	);
}
