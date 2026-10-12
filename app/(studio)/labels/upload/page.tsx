import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoading } from "@/components/spinner";
import { getUploadView } from "@/use-cases/upload";
import { UploadScreen } from "./upload-screen";

export const metadata: Metadata = { title: "Upload labels" };

export default function UploadPage() {
	return (
		<Suspense fallback={<PageLoading label="Loading…" />}>
			<Upload />
		</Suspense>
	);
}

async function Upload() {
	return <UploadScreen view={await getUploadView()} />;
}
