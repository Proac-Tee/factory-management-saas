import type { Metadata } from "next";
import { Suspense } from "react";
import { listCustomers } from "@/data-access/labels";
import { newDesign } from "@/entities/label";
import { requireMember } from "@/lib/auth";
import { LabelEditor } from "../label-editor";

export const metadata: Metadata = { title: "New label" };

export default function NewLabelPage() {
	return (
		<Suspense fallback={<p className="p-10 text-lg text-graphite">Loading…</p>}>
			<NewLabel />
		</Suspense>
	);
}

async function NewLabel() {
	const member = await requireMember("edit-labels");
	const customers = await listCustomers(member.claims);
	return <LabelEditor label={null} design={newDesign()} customers={customers} canEdit justSaved={false} />;
}
