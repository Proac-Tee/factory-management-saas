import type { Metadata } from "next";
import { Suspense } from "react";
import { getScan } from "@/use-cases/labels";
import { ScanScreen } from "./scan-screen";

export const metadata: Metadata = { title: "Scan" };

export default function ScanPage({ searchParams }: PageProps<"/scan">) {
	return (
		<Suspense fallback={<p className="p-10 text-lg text-graphite">Loading…</p>}>
			<Scan searchParams={searchParams} />
		</Suspense>
	);
}

async function Scan({ searchParams }: Pick<PageProps<"/scan">, "searchParams">) {
	const { mode, label } = await getScan(await searchParams);
	return <ScanScreen key={`${mode}-${label?.id ?? ""}`} mode={mode} label={label} />;
}
