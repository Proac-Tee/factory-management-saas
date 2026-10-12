import Link from "next/link";

export default function Page() {
	return (
		<main className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
			<h1 className="text-2xl font-semibold">Something went wrong</h1>
			<p>The link may have expired or already been used.</p>
			<Link href="/login" className="underline">
				Back to sign in
			</Link>
		</main>
	);
}
