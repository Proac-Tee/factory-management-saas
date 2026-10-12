import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getLabelEditor } from "@/use-cases/labels";
import { LabelEditor } from "../_components/editor/label-editor";

export const metadata: Metadata = { title: "Label" };

export default function LabelPage({ params, searchParams }: PageProps<"/labels/[id]">) {
	return (
		<Suspense fallback={<p className="p-10 text-lg text-graphite">Loading the label…</p>}>
			<Label params={params} searchParams={searchParams} />
		</Suspense>
	);
}

async function Label({ params, searchParams }: Pick<PageProps<"/labels/[id]">, "params" | "searchParams">) {
	const [{ id }, { saved }] = await Promise.all([params, searchParams]);
	const view = await getLabelEditor(id);
	if (!view) notFound();
	return <LabelEditor key={view.label?.id} view={view} justSaved={saved === "new"} />;
}
