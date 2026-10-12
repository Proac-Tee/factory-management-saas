import type { Metadata } from "next";
import { Suspense } from "react";
import { getLabel } from "@/data-access/labels";
import { requireMember } from "@/lib/auth";
import { ScanScreen } from "./scan-screen";

export const metadata: Metadata = { title: "Scan" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function ScanPage({ searchParams }: PageProps<"/scan">) {
	return (
		<Suspense fallback={<p className="p-10 text-lg text-graphite">Loading…</p>}>
			<Scan searchParams={searchParams} />
		</Suspense>
	);
}

async function Scan({ searchParams }: { searchParams: PageProps<"/scan">["searchParams"] }) {
	const member = await requireMember("use-labels");
	const params = await searchParams;
	const mode = params.mode === "check" ? "check" : "find";
	const labelId = typeof params.label === "string" && UUID.test(params.label) ? params.label : null;
	const label = mode === "check" && labelId ? await getLabel(member.claims, labelId) : null;
	return (
		<ScanScreen
			key={`${mode}-${label?.id ?? ""}`}
			mode={mode}
			label={label ? { id: label.id, name: label.name, barcode: label.barcode } : null}
		/>
	);
}
