import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getLabel } from "@/data-access/labels";
import { fieldsUsed, parseDesign } from "@/entities/label";
import { requireMember } from "@/lib/auth";
import { PrintScreen } from "./print-screen";

export const metadata: Metadata = { title: "Print labels" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function PrintPage({ params }: PageProps<"/labels/[id]/print">) {
	return (
		<Suspense fallback={<p className="p-10 text-lg text-graphite">Loading the label…</p>}>
			<Print params={params} />
		</Suspense>
	);
}

async function Print({ params }: { params: PageProps<"/labels/[id]/print">["params"] }) {
	const member = await requireMember("use-labels");
	const { id } = await params;
	if (!UUID.test(id)) notFound();
	const label = await getLabel(member.claims, id);
	if (!label) notFound();
	const design = parseDesign(label.design);
	if (!design.ok) throw new Error(`Label ${id} has a broken layout: ${design.message}`);
	return <PrintScreen label={label} design={design.design} fields={fieldsUsed(design.design)} />;
}
