import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getLabel, listCustomers } from "@/data-access/labels";
import { parseDesign } from "@/entities/label";
import { can } from "@/entities/roles";
import { requireMember } from "@/lib/auth";
import { LabelEditor } from "../label-editor";

export const metadata: Metadata = { title: "Label" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function LabelPage({ params, searchParams }: PageProps<"/labels/[id]">) {
	return (
		<Suspense fallback={<p className="p-10 text-lg text-graphite">Loading the label…</p>}>
			<Label params={params} searchParams={searchParams} />
		</Suspense>
	);
}

async function Label({
	params,
	searchParams,
}: {
	params: PageProps<"/labels/[id]">["params"];
	searchParams: PageProps<"/labels/[id]">["searchParams"];
}) {
	const member = await requireMember("use-labels");
	const [{ id }, { saved }] = await Promise.all([params, searchParams]);
	if (!UUID.test(id)) notFound();
	const [label, customers] = await Promise.all([getLabel(member.claims, id), listCustomers(member.claims)]);
	if (!label) notFound();
	const design = parseDesign(label.design);
	if (!design.ok) throw new Error(`Label ${id} has a broken layout: ${design.message}`);

	return (
		<LabelEditor
			key={label.id}
			label={label}
			design={design.design}
			customers={customers}
			canEdit={can(member.role, "edit-labels")}
			justSaved={saved === "new"}
		/>
	);
}
