"use client";

import { useState, useTransition } from "react";
import { archiveLabelAction } from "../../actions";

/** Archive or restore, with a confirm step: archived labels leave the library. */
export function ArchiveControl({ id, archived }: { id: string; archived: boolean }) {
	const [confirming, setConfirming] = useState(false);
	const [saving, startSaving] = useTransition();

	if (!confirming) {
		return (
			<button
				type="button"
				onClick={() => setConfirming(true)}
				className={`h-12 w-fit text-base font-bold underline underline-offset-2 ${archived ? "" : "text-hold"}`}
			>
				{archived ? "Restore this label" : "Archive this label"}
			</button>
		);
	}
	return (
		<div className="flex flex-col gap-3 rounded-md border-2 border-hold p-4">
			<p className="text-[15px] leading-5">
				{archived ? "Put this label back in the library?" : "Archive this label? It leaves the library but its checks and history stay."}
			</p>
			<div className="flex gap-2">
				<button
					type="button"
					disabled={saving}
					onClick={() =>
						startSaving(async () => {
							await archiveLabelAction(id, !archived);
							setConfirming(false);
						})
					}
					className={`h-12 flex-1 rounded-md px-3 font-bold text-stock ${archived ? "bg-ink" : "bg-hold"}`}
				>
					{saving ? "Saving…" : archived ? "Restore" : "Archive"}
				</button>
				<button type="button" onClick={() => setConfirming(false)} className="h-12 flex-1 rounded-md border border-ink font-bold">
					Keep as it is
				</button>
			</div>
		</div>
	);
}
