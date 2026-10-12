"use client";

import { useTransition } from "react";
import { useToast } from "@/components/toast";
import { archiveLabelAction } from "../../actions";

/**
 * Archive or restore. Archiving is undoable from the toast, so it needs no
 * confirm step: the label only leaves the library, its history stays.
 */
export function ArchiveControl({ id, archived }: { id: string; archived: boolean }) {
	const [saving, startSaving] = useTransition();
	const toast = useToast();

	const setArchived = (next: boolean) =>
		startSaving(async () => {
			const { ok } = await archiveLabelAction(id, next);
			if (!ok) {
				toast.show("That label couldn't be changed. Refresh the page and try again.", { tone: "problem" });
				return;
			}
			toast.show(next ? "Label archived" : "Label restored to the library", {
				action: next ? { label: "Undo", onClick: () => setArchived(false) } : undefined,
			});
		});

	return (
		<button
			type="button"
			disabled={saving}
			onClick={() => setArchived(!archived)}
			className={`h-12 w-fit text-base font-bold underline underline-offset-2 disabled:text-graphite ${archived ? "" : "text-hold"}`}
		>
			{saving ? "Saving…" : archived ? "Restore this label" : "Archive this label"}
		</button>
	);
}
