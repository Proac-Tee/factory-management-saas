import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getLabelToPrint } from "@/use-cases/labels";
import { PrintScreen } from "./print-screen";

export const metadata: Metadata = { title: "Print labels" };

export default function PrintPage({ params }: PageProps<"/labels/[id]/print">) {
	return (
		<Suspense fallback={<p className="p-10 text-lg text-graphite">Loading the label…</p>}>
			<Print params={params} />
		</Suspense>
	);
}

async function Print({ params }: Pick<PageProps<"/labels/[id]/print">, "params">) {
	const view = await getLabelToPrint((await params).id);
	if (!view) notFound();
	return <PrintScreen label={view.label} design={view.design} fields={view.fields} />;
}
