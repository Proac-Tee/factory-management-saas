"use client";

import Link from "next/link";
import { type DragEvent, useId, useMemo, useState } from "react";
import { Segmented } from "@/components/controls";
import { AlertTriangleIcon, CheckIcon, FolderIcon, UploadIcon } from "@/components/icons";
import { LabelRender } from "@/components/label-render";
import { Spinner } from "@/components/spinner";
import { button, fieldClass, labelClass, PageHeader } from "@/components/ui";
import { KIND_NAMES } from "@/entities/label";
import { sizeName } from "@/entities/library";
import type { UploadView } from "@/use-cases/upload";
import { filesFromDrop, filesFromInput, type Outcome, type PreviewLabel, type UploadState, useUpload } from "./use-upload";

const TOP = "";
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Upload a folder of LibreOffice labels, keeping its folders and each label's layout. */
export function UploadScreen({ view }: { view: UploadView }) {
	const upload = useUpload();
	const [parentId, setParentId] = useState(TOP);
	const { state } = upload;
	const destination = view.folders.find((f) => f.id === parentId)?.label ?? null;

	return (
		<div className="flex flex-1 flex-col">
			<PageHeader context={<Link href="/labels" className="underline underline-offset-2">Labels</Link>} title="Upload labels" />
			<div className="flex flex-col gap-6 px-4 pt-5 pb-12 md:px-10">
				{state.step === "choose" && (
					<Choose
						folders={view.folders}
						parentId={parentId}
						onParent={setParentId}
						onFiles={(files) => upload.read(files, destination ? destination.split(" / ") : [])}
					/>
				)}
				{state.step === "reading" && (
					<Progress text={`Reading ${state.done} of ${plural(state.total, "file", "files")}…`} done={state.done} total={state.total} />
				)}
				{state.step === "preview" && (
					<Preview
						state={state}
						destination={destination}
						replace={upload.replace}
						onReplace={upload.setReplace}
						onOuterLeftOut={upload.setOuterLeftOut}
						imageSrc={upload.imageSrc}
						onUpload={() => upload.upload(state.labels, parentId === TOP ? null : parentId)}
						onReset={upload.reset}
					/>
				)}
				{state.step === "uploading" && (
					<Progress
						text={
							state.phase === "pictures"
								? `Sending pictures, ${state.done} of ${state.total}…`
								: `Saving labels, ${state.done} of ${state.total}…`
						}
						done={state.done}
						total={state.total}
					/>
				)}
				{state.step === "done" && <Done outcome={state.outcome} onReset={upload.reset} />}
			</div>
		</div>
	);
}

function Choose({
	folders,
	parentId,
	onParent,
	onFiles,
}: {
	folders: UploadView["folders"];
	parentId: string;
	onParent: (id: string) => void;
	onFiles: (files: Awaited<ReturnType<typeof filesFromDrop>>) => void;
}) {
	const [over, setOver] = useState(false);
	const folderInput = useId();
	const fileInput = useId();
	const destination = useId();

	const drop = async (e: DragEvent) => {
		e.preventDefault();
		setOver(false);
		const files = await filesFromDrop(e.dataTransfer);
		if (files.length) onFiles(files);
	};

	return (
		<div className="flex max-w-[880px] flex-col gap-6">
			<div
				onDragOver={(e) => {
					e.preventDefault();
					setOver(true);
				}}
				onDragLeave={() => setOver(false)}
				onDrop={drop}
				className={`flex min-h-[300px] flex-col items-center justify-center gap-5 rounded-md border-2 border-dashed px-6 py-10 text-center ${
					over ? "border-ink bg-wash" : "border-rule"
				}`}
			>
				<FolderIcon size={40} />
				<div className="flex flex-col gap-2">
					<p className="text-xl leading-7 font-black tracking-tight">Drag a folder of labels here</p>
					<p className="max-w-[52ch] text-base leading-normal text-graphite">
						Its folders are kept, like AMAZON → AMAZON EU → SRP LABELS. Each label keeps its layout, pictures and barcode.
					</p>
				</div>
				<div className="flex flex-col gap-3 sm:flex-row">
					<label htmlFor={folderInput} className={`${button({ size: "md" })} cursor-pointer`}>
						<UploadIcon size={18} />
						Choose a folder
					</label>
					<label htmlFor={fileInput} className={`${button({ variant: "outline", size: "md" })} cursor-pointer`}>
						Choose files
					</label>
				</div>
				<input
					id={folderInput}
					type="file"
					className="sr-only"
					// A folder picker: every file inside, with its path.
					{...{ webkitdirectory: "", directory: "" }}
					onChange={(e) => e.target.files?.length && onFiles(filesFromInput(e.target.files))}
				/>
				<input
					id={fileInput}
					type="file"
					multiple
					accept=".odg"
					className="sr-only"
					onChange={(e) => e.target.files?.length && onFiles(filesFromInput(e.target.files))}
				/>
			</div>

			<div className="flex flex-col gap-1.5 sm:max-w-[420px]">
				<label htmlFor={destination} className={labelClass}>
					Put the folders in
				</label>
				<select id={destination} value={parentId} onChange={(e) => onParent(e.target.value)} className={`${fieldClass} cursor-pointer`}>
					<option value={TOP}>The top of the library</option>
					{folders.map((f) => (
						<option key={f.id} value={f.id}>
							{f.label}
						</option>
					))}
				</select>
				<p className="text-sm leading-5 text-graphite">
					Only LibreOffice Draw files (.odg) are read. Lock files, shortcuts and other files are left out.
				</p>
			</div>
		</div>
	);
}

function Progress({ text, done, total }: { text: string; done: number; total: number }) {
	return (
		<div role="status" className="flex max-w-[560px] flex-col gap-3 py-8">
			<p className="flex items-center gap-3 text-lg leading-6 font-bold tabular-nums">
				<Spinner size={22} />
				{text}
			</p>
			<div className="h-2 overflow-hidden rounded-full bg-wash">
				<div className="h-full bg-ink transition-[width]" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
			</div>
		</div>
	);
}

function Preview({
	state,
	destination,
	replace,
	onReplace,
	onOuterLeftOut,
	imageSrc,
	onUpload,
	onReset,
}: {
	state: Extract<UploadState, { step: "preview" }>;
	destination: string | null;
	replace: boolean;
	onReplace: (replace: boolean) => void;
	onOuterLeftOut: (leftOut: boolean) => void;
	imageSrc: (hash: string) => string;
	onUpload: () => void;
	onReset: () => void;
}) {
	const { labels, outer, skippedFiles, unreadable } = state;
	const groups = useMemo(() => {
		const map = new Map<string, PreviewLabel[]>();
		for (const l of labels) {
			const key = l.folderPath.join(" / ") || "Not in a folder";
			map.set(key, [...(map.get(key) ?? []), l]);
		}
		return [...map.entries()];
	}, [labels]);
	const existing = labels.filter((l) => l.exists).length;
	const withProblem = labels.filter((l) => l.problem).length;
	const noBarcode = labels.filter((l) => !l.barcode).length;
	const sending = labels.filter((l) => !l.problem && (replace || !l.exists)).length;

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-col gap-4 rounded-md bg-wash p-4 md:p-5">
				<div className="flex flex-col gap-1">
					<p className="text-lg leading-6 font-black tabular-nums">
						{plural(labels.length, "label", "labels")} in {plural(groups.length, "folder", "folders")}
					</p>
					<p className="text-base leading-6 text-graphite">
						Going into {destination ?? "the top of the library"}.
						{noBarcode > 0 && ` ${plural(noBarcode, "label has", "labels have")} no barcode number; add it in the label later.`}
					</p>
				</div>
				{outer && (
					<label className="flex cursor-pointer items-start gap-3 text-base leading-6">
						<input
							type="checkbox"
							checked={outer.leftOut}
							onChange={(e) => onOuterLeftOut(e.target.checked)}
							className="mt-1 size-5 shrink-0 cursor-pointer accent-ink"
						/>
						<span>
							Leave out the outer folder <span className="font-bold">“{outer.name}”</span>, so the folders inside it go straight
							into {destination ?? "the top of the library"}.
						</span>
					</label>
				)}
				{existing > 0 && (
					<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
						<p className="text-base leading-6 font-bold">{plural(existing, "label is", "labels are")} in the library already:</p>
						<Segmented
							label="Labels already in the library"
							hideLabel
							value={replace ? "replace" : "skip"}
							options={[
								["skip", "Skip them"],
								["replace", "Replace them"],
							]}
							onChange={(v) => onReplace(v === "replace")}
							className="sm:w-[320px]"
						/>
					</div>
				)}
				<div className="flex flex-col gap-3 sm:flex-row">
					<button type="button" disabled={sending === 0} onClick={onUpload} className={button({ size: "md" })}>
						<UploadIcon size={18} />
						{sending === 0 ? "Nothing to upload" : `Upload ${plural(sending, "label", "labels")}`}
					</button>
					<button type="button" onClick={onReset} className={button({ variant: "outline", size: "md" })}>
						Choose other files
					</button>
				</div>
			</div>

			{(unreadable.length > 0 || withProblem > 0) && (
				<Notice tone="problem" title={`${plural(unreadable.length + withProblem, "file", "files")} can't be uploaded`}>
					{unreadable.map((f) => (
						<li key={f.path}>
							<span className="font-bold">{f.path}</span>: {f.message}
						</li>
					))}
					{labels
						.filter((l) => l.problem)
						.map((l) => (
							<li key={l.sourceFile}>
								<span className="font-bold">{l.sourceFile}</span>: {l.problem}
							</li>
						))}
				</Notice>
			)}
			{skippedFiles.length > 0 && (
				<Notice tone="info" title={`${plural(skippedFiles.length, "file", "files")} left out`}>
					{skippedFiles.map((f) => (
						<li key={f.path}>
							<span className="font-bold">{f.path}</span>: {f.reason}
						</li>
					))}
				</Notice>
			)}

			{groups.map(([folder, items]) => (
				<section key={folder} aria-label={folder} className="flex flex-col gap-4">
					<div className="flex items-baseline justify-between gap-4 border-b border-ink pb-2">
						<h2 className="flex min-w-0 items-center gap-2 text-lg leading-6 font-black tracking-[-0.01em]">
							<FolderIcon size={20} className="shrink-0" />
							<span className="min-w-0 break-words">{folder}</span>
						</h2>
						<span className="shrink-0 text-sm leading-[18px] font-bold text-graphite tabular-nums">{plural(items.length, "label", "labels")}</span>
					</div>
					<ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-[repeat(auto-fill,minmax(184px,1fr))] md:gap-x-6">
						{items.map((l) => (
							<li key={l.sourceFile} className="flex flex-col gap-2.5 [content-visibility:auto] [contain-intrinsic-size:auto_260px]">
								<div className="flex aspect-square items-center justify-center rounded-[4px] border border-rule bg-stock p-2 [container-type:size]">
									<LabelRender design={l.design} barcode={l.barcode} scale="fit" imageSrc={imageSrc} />
								</div>
								<div className="flex flex-col gap-0.5">
									<span className="text-base leading-5 font-bold break-words">{l.name}</span>
									<span className="text-sm leading-[18px] text-graphite tabular-nums">
										{[KIND_NAMES[l.kind], sizeName(l.design)].join(", ")}
									</span>
									<span className={`text-sm leading-[18px] tabular-nums ${l.barcode ? "text-graphite" : "font-bold"}`}>
										{l.barcode ?? "No barcode number yet"}
									</span>
									{l.exists && (
										<span className="text-sm leading-[18px] font-bold">{replace ? "Replaces the one in the library" : "In the library; skipped"}</span>
									)}
									{l.problem && <span className="text-sm leading-[18px] font-bold text-hold">Can’t be uploaded</span>}
									{l.warnings.map((w) => (
										<span key={w} className="text-sm leading-[18px] text-graphite">
											{w}
										</span>
									))}
								</div>
							</li>
						))}
					</ul>
				</section>
			))}
		</div>
	);
}

function Notice({ tone, title, children }: { tone: "problem" | "info"; title: string; children: React.ReactNode }) {
	return (
		<details className={`rounded-md border p-4 ${tone === "problem" ? "border-hold" : "border-rule"}`}>
			<summary className="flex cursor-pointer items-center gap-2 text-base leading-6 font-bold">
				{tone === "problem" && <AlertTriangleIcon size={18} className="shrink-0 text-hold" />}
				{title}
			</summary>
			<ul className="mt-3 flex flex-col gap-1.5 text-sm leading-5 break-words">{children}</ul>
		</details>
	);
}

function Done({ outcome, onReset }: { outcome: Outcome; onReset: () => void }) {
	const { added, replaced, skipped, failed } = outcome;
	return (
		<div className="flex max-w-[720px] flex-col gap-5 py-4">
			<p role="status" className="flex items-center gap-3 text-xl leading-7 font-black tracking-tight">
				<CheckIcon size={24} strokeWidth={2.5} className="text-pass" />
				{[
					added && `Added ${plural(added, "label", "labels")}`,
					replaced && `replaced ${replaced}`,
					skipped && `skipped ${skipped} already in`,
				]
					.filter(Boolean)
					.join(", ") || "Nothing was added"}
			</p>
			{failed.length > 0 && (
				<Notice tone="problem" title={`${plural(failed.length, "label wasn't", "labels weren't")} uploaded`}>
					{failed.map((f) => (
						<li key={f.sourceFile}>
							<span className="font-bold">{f.sourceFile}</span>: {f.message}
						</li>
					))}
				</Notice>
			)}
			<div className="flex flex-col gap-3 sm:flex-row">
				<Link href="/labels" className={button({ size: "md" })}>
					Open the library
				</Link>
				<button type="button" onClick={onReset} className={button({ variant: "outline", size: "md" })}>
					Upload more
				</button>
			</div>
		</div>
	);
}
