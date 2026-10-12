"use client";

import { useId, useState, useTransition } from "react";
import { Spinner } from "@/components/spinner";
import { useToast } from "@/components/toast";
import { labelClass, panelFieldClass } from "@/components/ui";
import { moveLabelAction } from "../../actions";

const NONE = "";

/** Which folder the label is in. Moves straight away, apart from the label's other changes. */
export function FolderControl({
	labelId,
	folderId,
	folders,
	canEdit,
}: {
	labelId: string;
	folderId: string | null;
	folders: { id: string; label: string }[];
	canEdit: boolean;
}) {
	const id = useId();
	const [value, setValue] = useState(folderId ?? NONE);
	const [saving, startSaving] = useTransition();
	const toast = useToast();

	const move = (next: string) => {
		const before = value;
		setValue(next);
		startSaving(async () => {
			const result = await moveLabelAction({ labelId, folderId: next === NONE ? null : next });
			if (!result.ok) {
				setValue(before);
				toast.show(result.message, { tone: "problem" });
				return;
			}
			toast.show(next === NONE ? "Label taken out of its folder" : `Moved to ${folders.find((f) => f.id === next)?.label}`);
		});
	};

	return (
		<div className="flex flex-col gap-1.5">
			<label htmlFor={id} className={`${labelClass} flex items-center gap-2`}>
				Folder
				{saving && <Spinner />}
			</label>
			<select
				id={id}
				value={value}
				disabled={!canEdit || saving}
				onChange={(e) => move(e.target.value)}
				className={`${panelFieldClass.replace("bg-stock", "bg-wash")} cursor-pointer disabled:cursor-default`}
			>
				<option value={NONE}>Not in a folder</option>
				{folders.map((f) => (
					<option key={f.id} value={f.id}>
						{f.label}
					</option>
				))}
			</select>
			<p className="text-sm leading-5 text-graphite">Moves the label now; other changes still need saving.</p>
		</div>
	);
}
