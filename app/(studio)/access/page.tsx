import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoading } from "@/components/spinner";
import { getAccess } from "@/use-cases/access";
import { AccessScreen } from "./access-screen";

export const metadata: Metadata = { title: "People and access" };

export default function AccessPage() {
	return (
		<Suspense fallback={<PageLoading label="Loading people…" />}>
			<Access />
		</Suspense>
	);
}

async function Access() {
	const { rows, myEmail } = await getAccess();
	return <AccessScreen rows={rows} myEmail={myEmail} />;
}
