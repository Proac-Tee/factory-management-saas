import type { Metadata } from "next";
import { Suspense } from "react";
import { listAccess } from "@/data-access/members";
import { requireMember } from "@/lib/auth";
import { AccessScreen } from "./access-screen";

export const metadata: Metadata = { title: "People and access" };

export default function AccessPage() {
	return (
		<Suspense fallback={<p className="p-10 text-lg text-graphite">Loading people…</p>}>
			<Access />
		</Suspense>
	);
}

async function Access() {
	const admin = await requireMember("manage-access");
	return <AccessScreen rows={await listAccess()} myEmail={admin.email} />;
}
