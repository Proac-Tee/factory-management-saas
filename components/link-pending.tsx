"use client";

// Feedback while a link's page is on its way: a bar feeds across the top of
// the screen, and the link's own icon turns into a spinner. Put it inside a
// <Link>; it shows nothing once the page has arrived (or when it was instant).

import { useLinkStatus } from "next/link";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Spinner } from "./spinner";

export function LinkPending({
	icon,
	spinnerSize = 18,
	overlay = false,
}: {
	/** The link's own icon, swapped for a spinner while loading. */
	icon?: ReactNode;
	spinnerSize?: number;
	/** A spinner over the link's picture instead (its parent must be relative). */
	overlay?: boolean;
}) {
	const { pending } = useLinkStatus();
	return (
		<>
			{icon !== undefined && (pending ? <Spinner size={spinnerSize} /> : icon)}
			{overlay && pending && (
				<span className="absolute inset-0 flex items-center justify-center bg-stock/70 animate-[fade-in_120ms_ease-out]">
					<Spinner size={28} />
				</span>
			)}
			{pending && createPortal(<LoadingBar />, document.body)}
		</>
	);
}

function LoadingBar() {
	return (
		<div role="status" className="no-print pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px] overflow-hidden bg-rule">
			<span className="sr-only">Loading…</span>
			<div className="nav-progress h-full bg-ink" />
		</div>
	);
}
