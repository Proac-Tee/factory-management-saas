import type { Metadata } from "next";
import { Suspense } from "react";
import { getNewLabelEditor } from "@/use-cases/labels";
import { LabelEditor } from "../_components/editor/label-editor";

export const metadata: Metadata = { title: "New label" };

export default function NewLabelPage() {
	return (
		<Suspense fallback={<p className="p-10 text-lg text-graphite">Loading…</p>}>
			<NewLabel />
		</Suspense>
	);
}

async function NewLabel() {
	return <LabelEditor view={await getNewLabelEditor()} justSaved={false} />;
}
