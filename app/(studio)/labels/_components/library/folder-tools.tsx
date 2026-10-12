"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useId, useState, useTransition } from "react";
import { FolderPlusIcon, PencilIcon, TrashIcon } from "@/components/icons";
import { Spinner } from "@/components/spinner";
import { useToast } from "@/components/toast";
import { button, ErrorLine, fieldClass, labelClass } from "@/components/ui";
import { FOLDER_NAME_MAX } from "@/entities/folders";
import { createFolderAction, deleteFolderAction, moveFolderAction, renameFolderAction } from "../../actions";

type Mode = "idle" | "new" | "rename" | "move";
type Option = { id: string; label: string; depth: number };

const TOP = "";

/** Make a folder here; rename, move or delete the open one. The form opens under the row. */
export function FolderTools({
	open,
	parentId,
	moveTo,
	children,
}: {
	open: { id: string; name: string } | null;
	parentId: string | null;
	moveTo: Option[];
	/** What sits beside the buttons (the folder path). */
	children: ReactNode;
}) {
	const [mode, setMode] = useState<Mode>("idle");
	const [error, setError] = useState<string | null>(null);
	const [saving, startSaving] = useTransition();
	const router = useRouter();
	const toast = useToast();

	const switchTo = (next: Mode) => {
		setError(null);
		setMode((m) => (m === next ? "idle" : next));
	};

	const run = (action: () => Promise<{ ok: boolean; message: string }>, after?: () => void) =>
		startSaving(async () => {
			const result = await action();
			if (!result.ok) {
				setError(result.message);
				return;
			}
			setMode("idle");
			setError(null);
			toast.show(result.message);
			after?.();
		});

	const remove = () => {
		if (!open) return;
		startSaving(async () => {
			const result = await deleteFolderAction(open.id);
			if (!result.ok) {
				toast.show(result.message, { tone: "problem" });
				return;
			}
			toast.show(result.message);
			router.push(parentId ? `/labels?folder=${parentId}` : "/labels");
		});
	};

	const tool = `${button({ variant: "outline", size: "sm" })}`;

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
				{children}
				<div className="flex flex-wrap gap-2">
					<button type="button" className={tool} aria-expanded={mode === "new"} onClick={() => switchTo("new")}>
						<FolderPlusIcon size={18} />
						New folder
					</button>
					{open && (
						<>
							<button type="button" className={tool} aria-expanded={mode === "rename"} onClick={() => switchTo("rename")}>
								<PencilIcon size={18} />
								Rename
							</button>
							<button type="button" className={tool} aria-expanded={mode === "move"} onClick={() => switchTo("move")}>
								Move
							</button>
							<button type="button" className={`${tool} text-hold`} disabled={saving} onClick={remove}>
								{saving && mode === "idle" ? <Spinner /> : <TrashIcon size={18} />}
								Delete
							</button>
						</>
					)}
				</div>
			</div>

			{mode === "new" && (
				<NameForm
					key="new"
					label={open ? `New folder in ${open.name}` : "New folder"}
					submit="Make folder"
					saving={saving}
					error={error}
					onCancel={() => switchTo("new")}
					onSubmit={(name) => run(() => createFolderAction({ name, parentId: open?.id ?? null }))}
				/>
			)}
			{mode === "rename" && open && (
				<NameForm
					key="rename"
					label="Folder name"
					initial={open.name}
					submit="Rename"
					saving={saving}
					error={error}
					onCancel={() => switchTo("rename")}
					onSubmit={(name) => run(() => renameFolderAction({ id: open.id, name }))}
				/>
			)}
			{mode === "move" && open && (
				<MoveForm
					options={moveTo}
					current={parentId}
					saving={saving}
					error={error}
					onCancel={() => switchTo("move")}
					onSubmit={(to) => run(() => moveFolderAction({ id: open.id, parentId: to }))}
				/>
			)}
		</div>
	);
}

function NameForm({
	label,
	initial = "",
	submit,
	saving,
	error,
	onCancel,
	onSubmit,
}: {
	label: string;
	initial?: string;
	submit: string;
	saving: boolean;
	error: string | null;
	onCancel: () => void;
	onSubmit: (name: string) => void;
}) {
	const id = useId();
	const [name, setName] = useState(initial);
	return (
		<form
			className="flex w-full flex-col gap-2 md:max-w-[560px]"
			onSubmit={(e) => {
				e.preventDefault();
				onSubmit(name);
			}}
		>
			<label htmlFor={id} className={labelClass}>
				{label}
			</label>
			<input
				id={id}
				autoFocus
				value={name}
				maxLength={FOLDER_NAME_MAX}
				onChange={(e) => setName(e.target.value)}
				onKeyDown={(e) => e.key === "Escape" && onCancel()}
				aria-invalid={Boolean(error)}
				className={fieldClass}
			/>
			{error && <ErrorLine message={error} />}
			<FormButtons submit={submit} saving={saving} onCancel={onCancel} />
		</form>
	);
}

function MoveForm({
	options,
	current,
	saving,
	error,
	onCancel,
	onSubmit,
}: {
	options: Option[];
	current: string | null;
	saving: boolean;
	error: string | null;
	onCancel: () => void;
	onSubmit: (parentId: string | null) => void;
}) {
	const id = useId();
	const [to, setTo] = useState(current ?? TOP);
	return (
		<form
			className="flex w-full flex-col gap-2 md:max-w-[560px]"
			onSubmit={(e) => {
				e.preventDefault();
				onSubmit(to === TOP ? null : to);
			}}
		>
			<label htmlFor={id} className={labelClass}>
				Move into
			</label>
			<select id={id} value={to} onChange={(e) => setTo(e.target.value)} className={`${fieldClass} cursor-pointer`}>
				<option value={TOP}>The top level</option>
				{options.map((o) => (
					<option key={o.id} value={o.id}>
						{o.label}
					</option>
				))}
			</select>
			{error && <ErrorLine message={error} />}
			<FormButtons submit="Move here" saving={saving} onCancel={onCancel} />
		</form>
	);
}

function FormButtons({ submit, saving, onCancel }: { submit: string; saving: boolean; onCancel: () => void }) {
	return (
		<div className="flex gap-2">
			<button type="submit" disabled={saving} className={button({ size: "sm" })}>
				{saving && <Spinner />}
				{saving ? "Saving…" : submit}
			</button>
			<button type="button" onClick={onCancel} className={button({ variant: "outline", size: "sm" })}>
				Cancel
			</button>
		</div>
	);
}
