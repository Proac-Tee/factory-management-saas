import type { Metadata } from "next";
import { Suspense } from "react";
import { getLibrary } from "@/use-cases/labels";
import { LibraryScreen } from "./_components/library/library-screen";

export const metadata: Metadata = { title: "Labels" };

export default function LabelsPage({ searchParams }: PageProps<"/labels">) {
	return (
		<Suspense fallback={<p className="p-10 text-lg text-graphite">Loading labels…</p>}>
			<Library searchParams={searchParams} />
		</Suspense>
	);
}

async function Library({ searchParams }: Pick<PageProps<"/labels">, "searchParams">) {
	return <LibraryScreen view={await getLibrary(await searchParams)} />;
}
