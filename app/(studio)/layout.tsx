import { Suspense } from "react";
import { PageLoading } from "@/components/spinner";
import { StudioShell } from "@/components/studio-shell";
import { getMember } from "@/lib/auth";
import { logout } from "../(auth)/actions";

export default function StudioLayout({ children }: LayoutProps<"/">) {
	return (
		// Who's signed in comes from the request, so the shell streams in.
		<Suspense fallback={<PageLoading fullScreen />}>
			<Shell>{children}</Shell>
		</Suspense>
	);
}

async function Shell({ children }: { children: React.ReactNode }) {
	const member = await getMember();
	return (
		<StudioShell name={member.name} role={member.role} signOut={logout}>
			{children}
		</StudioShell>
	);
}
